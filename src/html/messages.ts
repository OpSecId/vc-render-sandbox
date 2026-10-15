/**
 * Host ↔ wrapper message shapes (delivered via parent.postMessage + handshake id).
 * `ready` / `error` mirror the W3C HTML suite draft; `followLink` is a sandbox
 * extension demonstrating privacy-preserving, host-mediated traversal (UNTP-style).
 */

export type FollowLinkRequest = {
  type: "followLink";
  href: string;
  linkType?: string;
  label?: string;
};

export type HostInboundMessage =
  | "ready"
  | { error: { message: string } }
  | FollowLinkRequest;

export function isFollowLinkRequest(data: unknown): data is FollowLinkRequest {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return obj.type === "followLink" && typeof obj.href === "string";
}
