/**
 * Per-page CSP nonce for srcdoc scripts.
 * index.html bootstrap sets window.__VCR_CSP_NONCE__ before the module loads.
 */

declare global {
  interface Window {
    __VCR_CSP_NONCE__?: string;
  }
}

export function getCspNonce(): string {
  const nonce = window.__VCR_CSP_NONCE__;
  if (!nonce || typeof nonce !== "string") {
    throw new Error(
      "CSP nonce missing — index.html bootstrap must set window.__VCR_CSP_NONCE__",
    );
  }
  return nonce;
}

/** Ensure every <script> in an HTML fragment carries the host nonce. */
export function applyNonceToScripts(html: string, nonce: string): string {
  const attr = ` nonce="${escapeAttr(nonce)}"`;
  return html.replace(/<script\b([^>]*)>/gi, (_match, attrs: string) => {
    if (/\bnonce\s*=/i.test(attrs)) {
      return `<script${attrs.replace(/\snonce\s*=\s*(['"]).*?\1/i, attr)}>`;
    }
    return `<script${attrs}${attr}>`;
  });
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
