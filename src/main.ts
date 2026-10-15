import { marked } from "marked";
import hostMediatedLinksDoc from "../docs/html-host-mediated-links.md?raw";
import { mountHtmlRenderMethod } from "./html/host";
import type { FollowLinkRequest } from "./html/messages";
import {
  approveOrigin,
  assertVerifiableCredentialShape,
  isOriginPreapproved,
  isSameOriginHref,
  loadStrictMode,
  originOfHref,
  policyFromStrict,
  saveStrictMode,
} from "./host-policy";
import { resolveDemoFetchUrl, withAppBase } from "./demo-urls";
import { collectFollowableUrls } from "./links";
import "./style.css";
import type { RenderMethod, VerifiableCredential } from "./types";
import {
  credentialTypes,
  describeMethod,
  isHtmlSuite,
  listRenderMethods,
  unwrapVc,
} from "./vc";

const app = document.getElementById("app")!;

type AppView = "demo" | "doc";
type StackEntry = {
  vc: VerifiableCredential;
  label: string;
  methodIndex: number;
};

let view: AppView = "demo";
let stack: StackEntry[] = [];
let disposeMount: (() => void) | null = null;
let eventLog: string[] = [];
let strictMode = loadStrictMode();

function current(): StackEntry | null {
  return stack[stack.length - 1] ?? null;
}

function withBase(path: string): string {
  return withAppBase(path);
}

function mountShell() {
  app.innerHTML = `
    <header>
      <div class="header-row">
        <h1>VC Render Sandbox</h1>
        <div class="header-tools">
          <label class="strict-toggle" title="Require template digests; always consent on cross-origin follow">
            <input type="checkbox" id="strict-mode" ${strictMode ? "checked" : ""} />
            <span>Strict</span>
          </label>
          <nav class="view-tabs" aria-label="App views">
            <a href="#demo" id="tab-demo" class="tab active" aria-current="page">Demo</a>
            <a href="#doc" id="tab-doc" class="tab">Doc</a>
          </nav>
          <a
            class="github-link"
            href="https://github.com/OpSecId/vc-render-sandbox"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52
                -.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2
                -3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64
                -.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
                1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0
                .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
          </a>
        </div>
      </div>
      <p id="header-blurb">
        W3C <a href="https://www.w3.org/TR/vc-render-method/" target="_blank" rel="noreferrer">VC Render Method</a>
        <code>html</code> suite host + experimental host-mediated links profile.
      </p>
    </header>

    <dialog id="consent-dialog" class="consent-dialog">
      <form method="dialog" id="consent-form">
        <h2>Allow host to fetch this link?</h2>
        <p class="consent-lead">
          The template requested a cross-origin credential. The sandboxed iframe cannot fetch it;
          the host will if you approve.
        </p>
        <dl class="consent-meta">
          <dt>Label</dt><dd id="consent-label"></dd>
          <dt>Origin</dt><dd id="consent-origin"></dd>
          <dt>URL</dt><dd id="consent-href" class="consent-url"></dd>
          <dt>linkType</dt><dd id="consent-linktype"></dd>
        </dl>
        <menu class="consent-actions">
          <button type="submit" value="cancel" class="secondary">Deny</button>
          <button type="submit" value="once" class="secondary">Allow once</button>
          <button type="submit" value="always" class="primary">Allow origin</button>
        </menu>
      </form>
    </dialog>

    <section id="demo-panel">
      <div id="loader" class="loader">
        <p class="loader-lead">
          HTML suite rendering stays sandboxed. Optional extension: follow only
          <code>linkURL</code> values from the filtered credential — host fetches after consent.
        </p>
        <div class="actions">
          <button type="button" id="load-untp" class="primary">
            UNTP copper cathode
          </button>
          <button type="button" id="load-passport" class="secondary">
            Simple passport
          </button>
          <button type="button" id="browse" class="secondary">Open JSON…</button>
        </div>
        <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Drop JSON file">
          Drop a VC JSON file
        </div>
      </div>
      <input type="file" id="file-input" accept=".json,application/json" hidden />
      <div id="status" class="status" aria-live="polite"></div>
      <div id="workspace" class="workspace" hidden>
        <div id="nav" class="nav"></div>
        <div id="toolbar"></div>
        <div id="output"></div>
      </div>
    </section>

    <section id="doc-panel" class="doc-panel" hidden>
      <article class="doc-article prose" id="doc-article"></article>
    </section>
  `;

  window.addEventListener("hashchange", () => setView(viewFromHash(), false));

  document.getElementById("strict-mode")!.addEventListener("change", (e) => {
    strictMode = (e.target as HTMLInputElement).checked;
    saveStrictMode(strictMode);
    pushLog(`Host strict mode ${strictMode ? "ON" : "OFF"}`);
    if (current()) void refresh();
  });

  document.getElementById("load-untp")!.addEventListener("click", () => {
    // Prefer local stamped credential (digests). relatedDocument.linkURL remain absolute
    // Pages URLs so cross-origin consent can be exercised in local dev.
    void loadUrl(withBase("/credentials/untp/dpp-cathode.json"), "Cathode DPP");
  });
  document.getElementById("load-passport")!.addEventListener("click", () => {
    void loadUrl(withBase("/credentials/product-passport.json"), "Product passport");
  });
  document.getElementById("browse")!.addEventListener("click", () => {
    (document.getElementById("file-input") as HTMLInputElement).click();
  });

  const dropzone = document.getElementById("dropzone")!;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) void loadFile(file);
  });

  for (const event of ["dragenter", "dragover"] as const) {
    dropzone.addEventListener(event, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  }
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadFile(file);
  });

  window.addEventListener("vcrender:follow-rejected", ((e: CustomEvent<FollowLinkRequest>) => {
    const req = e.detail;
    pushLog(
      `REJECTED followLink → ${req.href} (not a followable linkURL in filtered credential)`,
    );
    setStatus(
      `Host rejected followLink — not a linkURL in the filtered credential: ${req.href}`,
      true,
    );
    renderMetaExtras();
  }) as EventListener);

  renderDoc();
  setView(viewFromHash(), false);
  // Normalize empty hash to #demo so the Doc tab has a stable counterpart.
  if (!location.hash || location.hash === "#") {
    history.replaceState(null, "", "#demo");
  }
}

function viewFromHash(): AppView {
  const hash = (location.hash || "#demo").toLowerCase();
  if (hash === "#doc" || hash === "#docs") return "doc";
  return "demo";
}

function setView(next: AppView, updateHash = true) {
  view = next;
  const demo = document.getElementById("demo-panel")!;
  const doc = document.getElementById("doc-panel")!;
  const tabDemo = document.getElementById("tab-demo") as HTMLAnchorElement;
  const tabDoc = document.getElementById("tab-doc") as HTMLAnchorElement;
  const blurb = document.getElementById("header-blurb")!;

  const showDemo = next === "demo";
  demo.hidden = !showDemo;
  doc.hidden = showDemo;
  tabDemo.classList.toggle("active", showDemo);
  tabDoc.classList.toggle("active", !showDemo);
  if (showDemo) {
    tabDemo.setAttribute("aria-current", "page");
    tabDoc.removeAttribute("aria-current");
  } else {
    tabDoc.setAttribute("aria-current", "page");
    tabDemo.removeAttribute("aria-current");
  }

  const wantHash = showDemo ? "#demo" : "#doc";
  if (updateHash && location.hash.toLowerCase() !== wantHash) {
    history.pushState(null, "", wantHash);
  }

  blurb.innerHTML = showDemo
    ? `W3C <a href="https://www.w3.org/TR/vc-render-method/" target="_blank" rel="noreferrer">VC Render Method</a>
        <code>html</code> suite host + experimental host-mediated links profile.`
    : `Extension draft (not in the W3C TR): host-mediated links over MessageChannel — only <code>linkURL</code> slots; host fetches.`;
}

function setDemoLoaded(loaded: boolean) {
  const loader = document.getElementById("loader");
  const workspace = document.getElementById("workspace");
  if (loader) loader.hidden = loaded;
  if (workspace) workspace.hidden = !loaded;
}

function renderDoc() {
  const article = document.getElementById("doc-article")!;
  marked.setOptions({ gfm: true, breaks: false });
  article.innerHTML = marked.parse(hostMediatedLinksDoc, { async: false }) as string;
  // Open external links in a new tab
  article.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noreferrer");
  });
}

function setStatus(message: string, isError = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function pushLog(line: string) {
  const stamp = new Date().toLocaleTimeString();
  eventLog = [`[${stamp}] ${line}`, ...eventLog].slice(0, 16);
}

async function loadFile(file: File) {
  try {
    setView("demo", true);
    const text = await file.text();
    const vc = unwrapVc(JSON.parse(text));
    resetStack(vc, file.name);
    await refresh();
  } catch (err) {
    clearMount();
    stack = [];
    setDemoLoaded(false);
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

async function loadUrl(url: string, label: string) {
  try {
    setView("demo", true);
    setStatus(`Loading ${label}…`);
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`Fetch failed (${response.status}) for ${url}`);
    const vc = unwrapVc(await response.json());
    resetStack(vc, label);
    pushLog(`Host loaded ${url}`);
    await refresh();
  } catch (err) {
    setDemoLoaded(false);
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}

function resetStack(vc: VerifiableCredential, label: string) {
  clearMount();
  eventLog = [];
  const methods = listRenderMethods(vc);
  const htmlIdx = methods.findIndex((m) => isHtmlSuite(m));
  stack = [
    {
      vc,
      label,
      methodIndex: htmlIdx >= 0 ? htmlIdx : 0,
    },
  ];
  setDemoLoaded(true);
  setStatus("");
}

function clearMount() {
  disposeMount?.();
  disposeMount = null;
}

function renderNav() {
  const nav = document.getElementById("nav")!;
  if (stack.length === 0) {
    nav.innerHTML = "";
    return;
  }
  const crumbs = stack
    .map((entry, i) => {
      const currentMark = i === stack.length - 1 ? ' aria-current="page"' : "";
      return `<li${currentMark}><span>${escapeHtml(entry.label)}</span></li>`;
    })
    .join('<li class="sep" aria-hidden="true">/</li>');

  nav.innerHTML = `
    <div class="nav-row">
      <ol class="crumbs">${crumbs}</ol>
      <div class="nav-actions">
        <button type="button" id="back-btn" class="secondary" ${stack.length < 2 ? "disabled" : ""}>
          ← Back
        </button>
        <button type="button" id="reset-btn" class="secondary ghost">New</button>
      </div>
    </div>
  `;
  document.getElementById("back-btn")?.addEventListener("click", () => {
    if (stack.length < 2) return;
    clearMount();
    stack.pop();
    pushLog(`Host navigated back to ${current()?.label}`);
    void refresh();
  });
  document.getElementById("reset-btn")?.addEventListener("click", () => {
    clearMount();
    stack = [];
    eventLog = [];
    setDemoLoaded(false);
    document.getElementById("toolbar")!.innerHTML = "";
    document.getElementById("output")!.innerHTML = "";
    document.getElementById("nav")!.innerHTML = "";
    setStatus("");
  });
}

function renderToolbar() {
  const toolbar = document.getElementById("toolbar")!;
  const entry = current();
  if (!entry) {
    toolbar.innerHTML = "";
    return;
  }

  const methods = listRenderMethods(entry.vc);
  if (methods.length <= 1) {
    toolbar.innerHTML = "";
    return;
  }

  const methodOptions = methods
    .map((m, i) => `<option value="${i}">${escapeAttr(describeMethod(m, i))}</option>`)
    .join("");

  toolbar.innerHTML = `
    <div class="field">
      <label for="method-select">renderMethod</label>
      <select id="method-select">${methodOptions}</select>
    </div>
  `;

  const methodSelect = document.getElementById("method-select") as HTMLSelectElement;
  methodSelect.value = String(entry.methodIndex);
  methodSelect.addEventListener("change", () => {
    entry.methodIndex = Number(methodSelect.value) || 0;
    void refresh();
  });
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function currentMethod(): RenderMethod | null {
  const entry = current();
  if (!entry) return null;
  return listRenderMethods(entry.vc)[entry.methodIndex] ?? null;
}

/**
 * Scheme gate only. Followable linkURL allowlisting runs in the html host first.
 * Cross-origin https is allowed after consent — target must still send CORS headers.
 */
function isCredentialFetchAllowed(href: string): boolean {
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol === "https:") return true;
    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Resolve fetch target; rewrite this app's Pages URLs to the local stamped tree. */
function resolveFetchUrl(href: string): string {
  return resolveDemoFetchUrl(href);
}

type ConsentResult = "cancel" | "once" | "always";

function requestCrossOriginConsent(request: FollowLinkRequest): Promise<ConsentResult> {
  const dialog = document.getElementById("consent-dialog") as HTMLDialogElement;
  const form = document.getElementById("consent-form") as HTMLFormElement;
  document.getElementById("consent-label")!.textContent =
    request.label || "(none)";
  document.getElementById("consent-origin")!.textContent =
    originOfHref(request.href) || "(invalid)";
  document.getElementById("consent-href")!.textContent = request.href;
  document.getElementById("consent-linktype")!.textContent =
    request.linkType || "(none)";

  return new Promise((resolve) => {
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      dialog.removeEventListener("close", onClose);
      const v = dialog.returnValue as ConsentResult;
      resolve(v === "once" || v === "always" ? v : "cancel");
    };
    const onSubmit = (e: Event) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value) dialog.returnValue = submitter.value;
    };
    form.addEventListener("submit", onSubmit);
    dialog.addEventListener("close", onClose);
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
}

async function onFollowLink(request: FollowLinkRequest) {
  pushLog(
    `HOST followLink → ${request.href}` +
      (request.linkType ? ` (${request.linkType})` : ""),
  );

  if (!isCredentialFetchAllowed(request.href)) {
    const msg =
      `Host refused followLink — only https (or http://localhost) URLs are fetched: ${request.href}`;
    setStatus(msg, true);
    pushLog(msg);
    renderMetaExtras();
    return;
  }

  // Consent uses the issuer-asserted URL (may be cross-origin Pages).
  // Fetch may use a local mirror afterward for stamped digests.
  const policy = policyFromStrict(strictMode);
  const assertedOrigin = originOfHref(request.href);

  if (policy.requireCrossOriginConsent && !isSameOriginHref(request.href)) {
    if (!assertedOrigin) {
      setStatus(`Host refused followLink — invalid URL: ${request.href}`, true);
      return;
    }
    if (!isOriginPreapproved(assertedOrigin)) {
      const decision = await requestCrossOriginConsent(request);
      if (decision === "cancel") {
        pushLog(`HOST followLink denied by user → ${request.href}`);
        setStatus("Cross-origin follow denied.");
        renderMetaExtras();
        return;
      }
      if (decision === "always") {
        approveOrigin(assertedOrigin);
        pushLog(`HOST approved origin for session → ${assertedOrigin}`);
      }
    }
  }

  const fetchUrl = resolveFetchUrl(request.href);
  if (fetchUrl !== request.href) {
    pushLog(`HOST using local mirror → ${fetchUrl}`);
  }

  setStatus(`Host fetching ${fetchUrl}…`);

  try {
    const response = await fetch(fetchUrl, { credentials: "omit", mode: "cors" });
    if (!response.ok) {
      throw new Error(`Fetch failed (${response.status}) for ${fetchUrl}`);
    }
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Host fetched ${fetchUrl} but response is not JSON` +
          (contentType ? ` (${contentType})` : "") +
          ". followLink only opens verifiable credential JSON in this sandbox.",
      );
    }
    const vc = unwrapVc(parsed);
    assertVerifiableCredentialShape(vc);
    const label = request.label || request.linkType || request.href;
    clearMount();
    stack.push({
      vc,
      label,
      methodIndex: Math.max(
        0,
        listRenderMethods(vc).findIndex((m) => isHtmlSuite(m)),
      ),
    });
    pushLog(`Host opened related credential: ${label}`);
    await refresh();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
    pushLog(
      `HOST followLink failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    renderMetaExtras();
  }
}

function renderMetaExtras() {
  const logEl = document.getElementById("event-log");
  if (logEl) logEl.textContent = eventLog.join("\n") || "(no host events yet)";
}

async function refresh() {
  if (view !== "demo") return;
  const entry = current();
  if (!entry) {
    setDemoLoaded(false);
    return;
  }

  setDemoLoaded(true);
  renderNav();
  renderToolbar();
  const output = document.getElementById("output")!;

  const method = currentMethod();
  clearMount();

  output.innerHTML = `
    <div class="panel preview">
      <div id="sandbox" class="sandbox-host"></div>
    </div>
    <details class="debug">
      <summary>Host debug</summary>
      <div class="debug-grid">
        <div class="panel meta">
          <div class="panel-header">Event log</div>
          <pre id="event-log"></pre>
        </div>
        <div class="panel meta">
          <div class="panel-header">Filtered credential / allowlisted URLs</div>
          <pre id="meta"></pre>
        </div>
      </div>
    </details>
  `;

  const sandbox = document.getElementById("sandbox")!;
  const metaEl = document.getElementById("meta")!;
  const logEl = document.getElementById("event-log")!;
  logEl.textContent = eventLog.join("\n") || "(no host events yet)";

  if (!method) {
    setStatus("Credential has no renderMethod entries.", true);
    metaEl.textContent = JSON.stringify(
      { credentialTypes: credentialTypes(entry.vc) },
      null,
      2,
    );
    return;
  }

  if (!isHtmlSuite(method)) {
    setStatus(
      `Unsupported suite "${method.renderSuite ?? "(missing)"}" — this sandbox implements renderSuite "html".`,
      true,
    );
    metaEl.textContent = JSON.stringify({ selectedMethod: method }, null, 2);
    return;
  }

  try {
    const policy = policyFromStrict(strictMode);
    const result = await mountHtmlRenderMethod(sandbox, entry.vc, method, {
      title: method.name ?? "HTML render suite",
      requireTemplateDigest: policy.requireTemplateDigest,
      onFollowLink,
    });
    disposeMount = result.dispose;
    setStatus(strictMode ? "Strict host · digest required · linkURL allowlist" : "");
    metaEl.textContent = JSON.stringify(
      {
        profile: "html suite + host-mediated links extension",
        strictMode,
        stack: stack.map((s) => s.label),
        credentialTypes: credentialTypes(entry.vc),
        renderSuite: "html",
        templateSource: result.templateSource,
        followableLinkUrls: [...collectFollowableUrls(result.filteredCredential)],
        filteredCredential: result.filteredCredential,
        note: "followLink hrefs must be linkURL values in the filtered VC; host fetches after consent when cross-origin.",
      },
      null,
      2,
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
    metaEl.textContent = JSON.stringify(
      {
        error: err instanceof Error ? err.message : String(err),
        selectedMethod: method,
      },
      null,
      2,
    );
  }
}

mountShell();
