/**
 * Map published Pages asset URLs back to the local/dev app base.
 * Asserted linkURL/template.id stay absolute (consent + allowlist); fetches use
 * the local stamped copies so Strict digests work before Pages is redeployed.
 */

const PAGES_ORIGIN = "https://opsecid.github.io";
const PAGES_PREFIX = "/vc-render-sandbox/";

export function withAppBase(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const cleaned = path.replace(/^\//, "");
  return base.endsWith("/") ? base + cleaned : `${base}/${cleaned}`;
}

/** Prefer local mirror for this repo's Pages credentials/templates. */
export function resolveDemoFetchUrl(href: string): string {
  try {
    const url = new URL(
      href,
      typeof window !== "undefined" ? window.location.href : PAGES_ORIGIN,
    );
    if (url.origin === PAGES_ORIGIN && url.pathname.startsWith(PAGES_PREFIX)) {
      return withAppBase("/" + url.pathname.slice(PAGES_PREFIX.length));
    }
  } catch {
    /* fall through */
  }
  if (href.startsWith("/credentials/") || href.startsWith("/templates/")) {
    return withAppBase(href);
  }
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("data:")
  ) {
    return href;
  }
  return withAppBase(href.replace(/^\//, ""));
}
