import { isAssertedLink } from "../links";
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

export type HostMountOptions = {
  style?: OutputPreference["style"];
  title?: string;
  /**
   * Called when the template asks the host to follow a credential-borne link.
   * Host MUST validate the href against the filtered credential before fetching.
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

  const filteredCredential = filterCredential(vc, renderMethod.renderProperty);
  const allowlistDoc = options.linkAllowlistDocument ?? filteredCredential;
  const resolved = await resolveTemplate(renderMethod.template, {
    digestMultibase: renderMethod.digestMultibase,
  });

  const handshakeId = crypto.randomUUID();
  const srcdoc = buildWrapperSrcdoc(
    filteredCredential,
    resolved.html,
    handshakeId,
  );

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

  const { ready, dispose } = attachHostChannel(iframe, handshakeId, {
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

type ChannelOptions = {
  allowlistDoc: VerifiableCredential;
  onFollowLink?: (request: FollowLinkRequest) => void | Promise<void>;
};

type VcrenderMessage = {
  type: "vcrender";
  handshakeId: string;
  event: "ready" | "error" | "followLink";
  error?: { message?: string };
  href?: string;
  linkType?: string;
  label?: string;
};

function attachHostChannel(
  iframe: HTMLIFrameElement,
  handshakeId: string,
  options: ChannelOptions,
): { ready: Promise<void>; dispose: () => void } {
  let disposed = false;
  let timeout = 0;

  const dispose = () => {
    disposed = true;
    window.clearTimeout(timeout);
    window.removeEventListener("message", onWindowMessage);
  };

  let settleReady: () => void = () => {};
  let settleReject: (err: Error) => void = () => {};

  const onWindowMessage = (event: MessageEvent) => {
    if (disposed) return;
    const data = event.data as VcrenderMessage | null;
    if (!data || data.type !== "vcrender" || data.handshakeId !== handshakeId) {
      return;
    }
    // Prefer source match when available; opaque-origin iframes still send the
    // handshake id so we can accept even if source identity is quirky.
    if (event.source && event.source !== iframe.contentWindow) return;

    if (data.event === "ready") {
      settleReady();
      return;
    }

    if (data.event === "error") {
      settleReject(new Error(data.error?.message ?? "Unknown render error"));
      return;
    }

    if (data.event === "followLink" && typeof data.href === "string") {
      void handleFollowLink(
        {
          type: "followLink",
          href: data.href,
          linkType: data.linkType,
          label: data.label,
        },
        options,
      );
    }
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

    window.addEventListener("message", onWindowMessage);
  });

  return { ready, dispose };
}

async function handleFollowLink(
  request: FollowLinkRequest,
  options: ChannelOptions,
): Promise<void> {
  if (!isAssertedLink(options.allowlistDoc, request.href)) {
    console.warn(
      "[host] rejected followLink — href not asserted in credential:",
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
