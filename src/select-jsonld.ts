import { getByPointer, setByPointer } from "./json-pointer";
import type { VerifiableCredential } from "./types";

/**
 * Approximation of the Data Integrity `selectJsonLd` algorithm for sandbox use.
 * Copies each `renderProperty` JSON Pointer into a new document and always
 * preserves `@context` and `type` when present (needed for VC-shaped templates).
 *
 * @see https://www.w3.org/TR/vc-di-ecdsa/#selectjsonld
 * @see https://www.w3.org/TR/vc-render-method/#html-template-processing
 */
export function selectJsonLd(
  document: VerifiableCredential,
  pointers: string[],
): VerifiableCredential {
  const out: Record<string, unknown> = {};

  if ("@context" in document) out["@context"] = document["@context"];
  if ("type" in document) out.type = document.type;

  for (const pointer of pointers) {
    const value = getByPointer(document, pointer);
    if (value === undefined) continue;
    setByPointer(out, pointer, value);

    // Preserve JSON-LD node identity on intermediate objects when present.
    const parts = pointer.split("/").filter(Boolean);
    for (let depth = 1; depth < parts.length; depth++) {
      const parentPointer = "/" + parts.slice(0, depth).join("/");
      const parent = getByPointer(document, parentPointer);
      if (parent && typeof parent === "object" && !Array.isArray(parent) && "id" in parent) {
        const selectedParent = getByPointer(out, parentPointer);
        if (
          selectedParent &&
          typeof selectedParent === "object" &&
          !Array.isArray(selectedParent) &&
          !("id" in (selectedParent as object))
        ) {
          (selectedParent as Record<string, unknown>).id = (parent as { id: unknown }).id;
        }
      }
    }
  }

  return out as VerifiableCredential;
}

export function filterCredential(
  vc: VerifiableCredential,
  renderProperty: string[] | undefined,
): VerifiableCredential {
  if (!renderProperty || renderProperty.length === 0) {
    // Do not pass renderMethod itself into the template data block by default —
    // templates render claims, not the method descriptor. Spec says "entire VC"
    // when absent; we strip only renderMethod to avoid recursion / bloat.
    const { renderMethod: _rm, ...rest } = vc;
    return rest as VerifiableCredential;
  }
  return selectJsonLd(vc, renderProperty);
}
