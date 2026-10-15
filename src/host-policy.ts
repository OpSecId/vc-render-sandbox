/**
 * Host security policy for the HTML suite + host-mediated links extension.
 * Strict mode is the default — demo toggles may relax digest requirements only.
 */

const STORAGE_ORIGINS = "vcrender:allowed-follow-origins";
const STORAGE_STRICT = "vcrender:strict-mode";

export type HostPolicy = {
  /** Refuse remote templates without digestMultibase (default true). */
  requireTemplateDigest: boolean;
  /** Prompt before fetching a followLink target on another origin (default true). */
  requireCrossOriginConsent: boolean;
};

export function loadStrictMode(): boolean {
  try {
    const v = sessionStorage.getItem(STORAGE_STRICT);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function saveStrictMode(strict: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_STRICT, strict ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function policyFromStrict(strict: boolean): HostPolicy {
  return {
    requireTemplateDigest: strict,
    requireCrossOriginConsent: true,
  };
}

export function isSameOriginHref(href: string, base = window.location.href): boolean {
  try {
    const url = new URL(href, base);
    return url.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

export function originOfHref(href: string, base = window.location.href): string | null {
  try {
    return new URL(href, base).origin;
  } catch {
    return null;
  }
}

export function isOriginPreapproved(origin: string): boolean {
  return readAllowedOrigins().has(origin);
}

export function approveOrigin(origin: string): void {
  const set = readAllowedOrigins();
  set.add(origin);
  try {
    sessionStorage.setItem(STORAGE_ORIGINS, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function readAllowedOrigins(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_ORIGINS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

/** Minimal VC shape check before stacking a followed document. */
export function assertVerifiableCredentialShape(doc: unknown): void {
  if (!doc || typeof doc !== "object") {
    throw new Error("Follow target is not a JSON object");
  }
  const o = doc as Record<string, unknown>;
  const types = o.type;
  const list = Array.isArray(types) ? types : types != null ? [types] : [];
  if (!list.map(String).includes("VerifiableCredential")) {
    throw new Error(
      'Follow target is not a VerifiableCredential (missing type "VerifiableCredential")',
    );
  }
}
