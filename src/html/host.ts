import { getCspNonce } from "../csp-nonce";
import { isFollowableLink } from "../links";
import { filterCredential } from "../select-jsonld";
import { resolveTemplate } from "../template";
import type {
  HtmlRenderResult,
  OutputPreference,
  RenderMethod,
  VerifiableCredential,
} from "../types";
import type { FollowLinkRequest } from "./messages";
import { buildWrapperSrcdoc } from "./wrapper";

/**
 * HTML Template Processing — Host Page algorithm.
 * @see https://www.w3.org/TR/vc-render-method/#html-template-processing
 */

const SANDBOX = "allow-scripts";

/** Templates MUST be fragments — no html/head/body (provided by wrapper). */
const FORBIDDEN_TEMPLATE_TAG = /<\s*\/?\s*(?:html|head|body)\b/i;

/** Block remote script/src in fragments (wrapper CSP also blocks network). */
const REMOTE_SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=/i;

export type HostMountOptions = {
  style?: OutputPreference["style"];
  title?: string;
  /** Require digestMultibase for non-data: templates (strict host policy). */
  requireTemplateDigest?: boolean;
  /**
   * Called when the template asks the host to follow a credential-borne link.
   * Host MUST validate the href against followable linkURL slots before fetching.
   */
  onFollowLink?: (request: FollowLinkRequest) => void | Promise<void>;
  /** Document used for allowlisting (defaults to filtered credential). */
  linkAllowlistDocument?: VerifiableCredential;
};

export async function mountHtmlRenderMethod(
  host: HTMLElement,
  vc: VerifiableCredential,
  renderMethod: RenderMethod,
  options: HostMountOptions = {},
): Promise<HtmlRenderResult> {
  if (renderMethod.type !== "SuiteRenderMethod") {
    throw new Error(
      `Expected type "SuiteRenderMethod", got ${JSON.stringify(renderMethod.type)}`,
    );
  }
  if (renderMethod.renderSuite !== "html") {
    throw new Error(
      `Expected renderSuite "html", got ${JSON.stringify(renderMethod.renderSuite)}`,
    );
  }
  if (renderMethod.template == null) {
    throw new Error('renderMethod.template is required for the html render suite');
  }

  const filteredCredential = filterCredential(vc, renderMethod.renderProperty);
  const allowlistDoc = options.linkAllowlistDocument ?? filteredCredential;
  const resolved = await resolveTemplate(renderMethod.template, {
    digestMultibase: renderMethod.digestMultibase,
    requireDigest: options.requireTemplateDigest === true,
  });

  validateTemplateFragment(resolved.html);

  const nonce = getCspNonce();
  const srcdoc = buildWrapperSrcdoc(filteredCredential, resolved.html, nonce);

  host.innerHTML = "";
  host.classList.add("sandbox-host");

  const iframe = document.createElement("iframe");
  iframe.className = "sandbox-iframe";
  iframe.hidden = true;
  if (options.title) iframe.title = options.title;
  iframe.setAttribute("sandbox", SANDBOX);
  iframe.setAttribute("referrerpolicy", "no-referrer");

  const style = options.style ?? renderMethod.outputPreference?.style;
  if (style?.width) iframe.style.width = String(style.width);
  if (style?.height) iframe.style.height = String(style.height);

  const { ready, dispose } = attachHostChannel(iframe, {
    allowlistDoc,
    onFollowLink: options.onFollowLink,
  });

  host.appendChild(iframe);
  iframe.srcdoc = srcdoc;

  try {
    await ready;
    iframe.hidden = false;
  } catch (err) {
    dispose();
    iframe.hidden = true;
    throw err;
  }

  return {
    ready: Promise.resolve(),
    iframe,
    filteredCredential,
    templateSource: resolved.source + (resolved.digestVerified ? " (digest ok)" : ""),
    dispose,
  };
}

export function validateTemplateFragment(html: string): void {
  if (FORBIDDEN_TEMPLATE_TAG.test(html)) {
    throw new Error(
      "HTML template MUST be a fragment and MUST NOT include <html>, <head>, or <body> tags",
    );
  }
  if (REMOTE_SCRIPT_SRC.test(html)) {
    throw new Error(
      "HTML template MUST NOT include remote <script src> — scripts must be inline fragments",
    );
  }
}

type ChannelOptions = {
  allowlistDoc: VerifiableCredential;
  onFollowLink?: (request: FollowLinkRequest) => void | Promise<void>;
};

function attachHostChannel(
  iframe: HTMLIFrameElement,
  options: ChannelOptions,
): { ready: Promise<void>; dispose: () => void } {
  let disposed = false;
  let timeout = 0;
  let port1: MessagePort | null = null;
  let readySettled = false;

  const dispose = () => {
    disposed = true;
    window.clearTimeout(timeout);
    iframe.removeEventListener("load", onLoad);
    try {
      port1?.close();
    } catch {
      /* ignore */
    }
    port1 = null;
  };

  let settleReady: () => void = () => {};
  let settleReject: (err: Error) => void = () => {};

  const onPortMessage = (event: MessageEvent) => {
    if (disposed) return;
    const data = event.data;

    if (data === "ready") {
      readySettled = true;
      settleReady();
      return;
    }

    if (data && typeof data === "object" && "error" in data) {
      const message =
        (data as { error?: { message?: string } }).error?.message ??
        "Unknown render error";
      settleReject(new Error(message));
      return;
    }

    // Extension messages only after successful ready (channel stays open).
    if (!readySettled) return;

    if (
      data &&
      typeof data === "object" &&
      (data as { type?: string }).type === "followLink" &&
      typeof (data as { href?: unknown }).href === "string"
    ) {
      void handleFollowLink(
        {
          type: "followLink",
          href: (data as { href: string }).href,
          linkType: (data as { linkType?: string }).linkType,
          label: (data as { label?: string }).label,
        },
        options,
      );
    }
  };

  const onLoad = () => {
    if (disposed) return;
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) {
      settleReject(new Error("HTML render iframe has no contentWindow"));
      return;
    }

    const channel = new MessageChannel();
    port1 = channel.port1;
    port1.start();
    port1.onmessage = onPortMessage;
    contentWindow.postMessage("start", "*", [channel.port2]);
  };

  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    settleReady = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(err);
    };

    timeout = window.setTimeout(() => {
      settleReject(
        new Error(
          "HTML template did not call window.renderMethodReady() within 8s",
        ),
      );
    }, 8000);

    iframe.addEventListener("load", onLoad);
  });

  return { ready, dispose };
}

async function handleFollowLink(
  request: FollowLinkRequest,
  options: ChannelOptions,
): Promise<void> {
  if (!isFollowableLink(options.allowlistDoc, request.href)) {
    console.warn(
      "[host] rejected followLink — href is not a followable linkURL in credential:",
      request.href,
    );
    window.dispatchEvent(
      new CustomEvent("vcrender:follow-rejected", { detail: request }),
    );
    return;
  }

  if (options.onFollowLink) {
    await options.onFollowLink(request);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("vcrender:follow", { detail: request }),
  );
}
