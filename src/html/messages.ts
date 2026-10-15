/**
 * Host ↔ wrapper message shapes delivered via MessageChannel (HTML suite).
 * `ready` / `error` match the W3C HTML suite algorithm; `followLink` is a
 * sandbox extension for privacy-preserving, host-mediated traversal.
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
