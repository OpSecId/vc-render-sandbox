import type { RenderMethod, VerifiableCredential } from "./types";

export function unwrapVc(raw: unknown): VerifiableCredential {
  if (!raw || typeof raw !== "object") {
    throw new Error("Expected a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.verifiableCredential && typeof obj.verifiableCredential === "object") {
    return obj.verifiableCredential as VerifiableCredential;
  }
  return obj as VerifiableCredential;
}

export function listRenderMethods(vc: VerifiableCredential): RenderMethod[] {
  const rm = vc.renderMethod;
  if (!rm) return [];
  return (Array.isArray(rm) ? rm : [rm]) as RenderMethod[];
}

export function credentialTypes(vc: VerifiableCredential): string[] {
  if (!vc.type) return [];
  return Array.isArray(vc.type) ? vc.type : [vc.type];
}

export function isHtmlSuite(method: RenderMethod | null | undefined): boolean {
  return (
    method?.type === "SuiteRenderMethod" && method.renderSuite === "html"
  );
}

export function describeMethod(method: RenderMethod, index: number): string {
  const suite = method.renderSuite ?? "(no suite)";
  const name = method.name ? ` · ${method.name}` : "";
  return `${index}: ${method.type} / ${suite}${name}`;
}
