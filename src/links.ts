/**
 * Collect URI-like strings asserted in credential JSON so the host can allowlist
 * followLink targets. Templates cannot invent destinations the VC did not contain.
 */

const URI_LIKE =
  /^(https?:\/\/|\/|did:|urn:|data:)/i;

export function collectAssertedUrls(doc: unknown): Set<string> {
  const urls = new Set<string>();
  walk(doc, (value) => {
    if (typeof value === "string" && URI_LIKE.test(value)) {
      urls.add(value);
    }
  });
  return urls;
}

export function isAssertedLink(doc: unknown, href: string): boolean {
  return collectAssertedUrls(doc).has(href);
}

function walk(node: unknown, visit: (value: unknown) => void): void {
  visit(node);
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    walk(value, visit);
  }
}
