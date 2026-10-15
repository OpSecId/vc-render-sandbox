/**
 * digestMultibase verification per VC Render Method:
 * multibase `u` (base64url-nopad) + multihash SHA-2-256 (`0x12`, length `0x20`).
 * @see https://www.w3.org/TR/vc-render-method/#the-rendermethod-property
 */

function base64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return new Uint8Array(digest);
}

/** Encode a SHA-256 digest as normative digestMultibase (`u` + multihash). */
export async function digestMultibaseSha256(content: Uint8Array | string): Promise<string> {
  const bytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const hash = await sha256(bytes);
  const multihash = new Uint8Array(2 + hash.length);
  multihash[0] = 0x12;
  multihash[1] = 0x20;
  multihash.set(hash, 2);
  return `u${bytesToBase64Url(multihash)}`;
}

export async function verifyDigestMultibase(
  content: Uint8Array | string,
  expected: string,
): Promise<void> {
  if (!expected.startsWith("u")) {
    throw new Error(
      `digestMultibase must use multibase "u" (base64url-nopad); got prefix "${expected[0] ?? ""}"`,
    );
  }
  const actual = await digestMultibaseSha256(content);
  if (actual !== expected) {
    throw new Error(
      `digestMultibase mismatch: expected ${expected}, computed ${actual}`,
    );
  }
}
