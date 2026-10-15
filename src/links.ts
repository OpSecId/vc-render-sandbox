/**
 * Followable URLs for host-mediated links.
 *
 * Only `linkURL` property values are eligible (UNTP Link / evidence Link shape).
 * Issuer ids, scheme ids, and other https strings in the filtered VC are NOT
 * followable — that closes the "any URI-shaped string" confused-deputy hole.
 */

const FORBIDDEN_FOLLOW_SCHEME = /^(javascript|data|blob|file|vbscript):/i;

export function collectFollowableUrls(doc: unknown): Set<string> {
  const urls = set();
  walkLinkUrls(doc, (url) => {
    if (isFollowableHref(url)) urls.add(url);
  });
  return urls;
}

/** @deprecated alias — prefer collectFollowableUrls */
export function collectAssertedUrls(doc: unknown): Set<string> {
  return collectFollowableUrls(doc);
}

export function isFollowableLink(doc: unknown, href: string): boolean {
  if (!isFollowableHref(href)) return false;
  return collectFollowableUrls(doc).has(href);
}

/** @deprecated alias — prefer isFollowableLink */
export function isAssertedLink(doc: unknown, href: string): boolean {
  return isFollowableLink(doc, href);
}

export function isFollowableHref(href: string): boolean {
  if (typeof href !== "string" || !href) return false;
  if (FORBIDDEN_FOLLOW_SCHEME.test(href)) return false;
  if (href.startsWith("/")) return true;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function set(): Set<string> {
  return new Set<string>();
}

function walkLinkUrls(node: unknown, visit: (url: string) => void): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkLinkUrls(item, visit);
    return;
  }
  if (typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "linkURL" && typeof value === "string") {
      visit(value);
    }
    walkLinkUrls(value, visit);
  }
}
