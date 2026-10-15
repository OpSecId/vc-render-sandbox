import { marked } from "marked";
import hostMediatedLinksDoc from "../docs/html-host-mediated-links.md?raw";
import { mountHtmlRenderMethod } from "./html/host";
import type { FollowLinkRequest } from "./html/messages";
import { collectAssertedUrls } from "./links";
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

function current(): StackEntry | null {
  return stack[stack.length - 1] ?? null;
}

function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleaned = path.replace(/^\//, "");
  return base.endsWith("/") ? base + cleaned : `${base}/${cleaned}`;
}

function mountShell() {
  app.innerHTML = `
    <header>
      <div class="header-row">
        <h1>VC Render Sandbox</h1>
        <nav class="view-tabs" aria-label="App views">
          <button type="button" id="tab-demo" class="tab" aria-pressed="true">Demo</button>
          <button type="button" id="tab-doc" class="tab" aria-pressed="false">Doc</button>
        </nav>
      </div>
      <p id="header-blurb">
        W3C <a href="https://www.w3.org/TR/vc-render-method/" target="_blank" rel="noreferrer">VC Render Method</a>
        <code>html</code> suite host — UNTP copper-cathode supply chain with
        <strong>host-mediated link traversal</strong>.
      </p>
    </header>

    <section id="demo-panel">
      <div class="actions">
        <button type="button" id="load-untp" class="primary">
          Start UNTP cathode demo
        </button>
        <button type="button" id="load-passport" class="secondary">
          Simple passport
        </button>
        <button type="button" id="browse" class="secondary">Browse JSON…</button>
      </div>
      <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Drop JSON file">
        <strong>Drop a VC JSON file here</strong>
        <span>or start the UNTP graph:
          <code>credentials/untp/dpp-cathode.json</code>
          → DCC / DFR / DTE / DCR / DIA</span>
      </div>
      <input type="file" id="file-input" accept=".json,application/json" hidden />
      <div id="nav" class="nav" hidden></div>
      <div id="toolbar"></div>
      <div id="status" class="status"></div>
      <div id="output"></div>
    </section>

    <section id="doc-panel" class="doc-panel" hidden>
      <article class="doc-article prose" id="doc-article"></article>
    </section>
  `;

  document.getElementById("tab-demo")!.addEventListener("click", () => setView("demo"));
  document.getElementById("tab-doc")!.addEventListener("click", () => setView("doc"));

  document.getElementById("load-untp")!.addEventListener("click", () => {
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
      `REJECTED followLink → ${req.href} (not asserted in credential; template cannot phone home)`,
    );
    setStatus(
      `Host rejected followLink — URL not in credential: ${req.href}`,
      true,
    );
    renderMetaExtras();
  }) as EventListener);

  renderDoc();
  setView("demo");
}

function setView(next: AppView) {
  view = next;
  const demo = document.getElementById("demo-panel")!;
  const doc = document.getElementById("doc-panel")!;
  const tabDemo = document.getElementById("tab-demo") as HTMLButtonElement;
  const tabDoc = document.getElementById("tab-doc") as HTMLButtonElement;
  const blurb = document.getElementById("header-blurb")!;

  const showDemo = next === "demo";
  demo.hidden = !showDemo;
  doc.hidden = showDemo;
  tabDemo.setAttribute("aria-pressed", String(showDemo));
  tabDoc.setAttribute("aria-pressed", String(!showDemo));
  tabDemo.classList.toggle("active", showDemo);
  tabDoc.classList.toggle("active", !showDemo);

  blurb.innerHTML = showDemo
    ? `W3C <a href="https://www.w3.org/TR/vc-render-method/" target="_blank" rel="noreferrer">VC Render Method</a>
        <code>html</code> suite host — UNTP copper-cathode supply chain with
        <strong>host-mediated link traversal</strong>.`
    : `Extension draft: <strong>Host-Mediated Links for the HTML Render Suite</strong>
        — how templates request issuer-asserted credential links without phoning home.`;
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
    setView("demo");
    const text = await file.text();
    const vc = unwrapVc(JSON.parse(text));
    resetStack(vc, file.name);
    await refresh();
  } catch (err) {
    clearMount();
    stack = [];
    setStatus(err instanceof Error ? err.message : String(err), true);
    document.getElementById("toolbar")!.innerHTML = "";
    document.getElementById("output")!.innerHTML = "";
    document.getElementById("nav")!.hidden = true;
  }
}

async function loadUrl(url: string, label: string) {
  try {
    setView("demo");
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`Fetch failed (${response.status}) for ${url}`);
    const vc = unwrapVc(await response.json());
    resetStack(vc, label);
    pushLog(`Host loaded ${url}`);
    await refresh();
  } catch (err) {
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
  setStatus(`Loaded ${label}`);
}

function clearMount() {
  disposeMount?.();
  disposeMount = null;
}

function renderNav() {
  const nav = document.getElementById("nav")!;
  if (stack.length === 0) {
    nav.hidden = true;
    nav.innerHTML = "";
    return;
  }
  nav.hidden = false;
  const crumbs = stack
    .map((entry, i) => {
      const currentMark = i === stack.length - 1 ? ' aria-current="page"' : "";
      return `<li${currentMark}><span>${escapeHtml(entry.label)}</span></li>`;
    })
    .join('<li class="sep" aria-hidden="true">/</li>');

  nav.innerHTML = `
    <div class="nav-row">
      <ol class="crumbs">${crumbs}</ol>
      <button type="button" id="back-btn" class="secondary" ${stack.length < 2 ? "disabled" : ""}>
        ← Back
      </button>
    </div>
  `;
  document.getElementById("back-btn")?.addEventListener("click", () => {
    if (stack.length < 2) return;
    clearMount();
    stack.pop();
    pushLog(`Host navigated back to ${current()?.label}`);
    void refresh();
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
  const methodOptions =
    methods.length === 0
      ? `<option value="0">(no renderMethod)</option>`
      : methods
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

function isCredentialFetchAllowed(href: string): boolean {
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Resolve relative credential URLs against the app base (GH Pages project sites). */
function resolveFetchUrl(href: string): string {
  if (href.startsWith("/credentials/") || href.startsWith("/templates/")) {
    return withBase(href);
  }
  return href;
}

async function onFollowLink(request: FollowLinkRequest) {
  pushLog(
    `HOST followLink → ${request.href}` +
      (request.linkType ? ` (${request.linkType})` : ""),
  );

  if (!isCredentialFetchAllowed(request.href)) {
    const msg =
      `Host refused followLink to cross-origin URL (sandbox only fetches same-origin credential JSON): ${request.href}`;
    setStatus(msg, true);
    pushLog(msg);
    renderMetaExtras();
    return;
  }

  const fetchUrl = resolveFetchUrl(request.href);
  setStatus(`Host fetching ${fetchUrl}…`);

  try {
    const response = await fetch(fetchUrl, { credentials: "omit" });
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
  renderNav();
  renderToolbar();
  const output = document.getElementById("output")!;
  const entry = current();
  if (!entry) {
    output.innerHTML = "";
    return;
  }

  const method = currentMethod();
  clearMount();

  output.innerHTML = `
    <div class="panel">
      <div class="panel-header">Sandbox preview (iframe · allow-scripts only)</div>
      <div id="sandbox"></div>
    </div>
    <div class="panel meta">
      <div class="panel-header">Host event log</div>
      <pre id="event-log"></pre>
    </div>
    <div class="panel meta">
      <div class="panel-header">Filtered credential / allowlisted URLs</div>
      <pre id="meta"></pre>
    </div>
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
    const result = await mountHtmlRenderMethod(sandbox, entry.vc, method, {
      title: method.name ?? "HTML render suite",
      onFollowLink,
    });
    disposeMount = result.dispose;
    setStatus(`HTML suite ready · template ${result.templateSource}`);
    metaEl.textContent = JSON.stringify(
      {
        stack: stack.map((s) => s.label),
        credentialTypes: credentialTypes(entry.vc),
        renderSuite: "html",
        templateSource: result.templateSource,
        assertedUrls: [...collectAssertedUrls(result.filteredCredential)],
        filteredCredential: result.filteredCredential,
        note: "followLink hrefs must be in assertedUrls (filtered VC); host performs fetch.",
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
