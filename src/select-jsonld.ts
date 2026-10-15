import { parsePointer } from "./json-pointer";
import type { VerifiableCredential } from "./types";

/**
 * `selectJsonLd` per VC-DI-ECDSA §3.4.13 (compact JSON-LD / aliased id+type).
 * Used by the HTML suite to build the filtered credential data block.
 *
 * @see https://www.w3.org/TR/vc-di-ecdsa/#selectjsonld
 * @see https://www.w3.org/TR/vc-render-method/#html-template-processing
 */

function isBlankNodeId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("_:");
}

function deepCopy<T>(value: T): T {
  return structuredClone(value);
}

/** §3.4.11 createInitialSelection */
function createInitialSelection(source: Record<string, unknown>): Record<string, unknown> {
  const selection: Record<string, unknown> = {};
  if ("id" in source && !isBlankNodeId(source.id)) {
    selection.id = source.id;
  }
  if ("type" in source) {
    selection.type = deepCopy(source.type);
  }
  return selection;
}

/**
 * §3.4.12 selectPaths — populate selectionDocument along one pointer path.
 * Tracks sparse arrays so they can be densified after all pointers.
 */
function selectPaths(
  paths: string[],
  document: Record<string, unknown>,
  selectionDocument: Record<string, unknown>,
  arrays: unknown[][],
): void {
  let parentValue: unknown = document;
  let value: unknown = parentValue;
  let selectedParent: Record<string, unknown> | unknown[] = selectionDocument;
  let selectedValue: unknown = selectedParent;

  for (const path of paths) {
    selectedParent = selectedValue as Record<string, unknown> | unknown[];
    parentValue = value;

    if (parentValue == null || typeof parentValue !== "object") {
      throw new Error(`JSON pointer does not match the document at "${path}"`);
    }

    if (Array.isArray(parentValue)) {
      const index = Number(path);
      if (!Number.isInteger(index) || index < 0) {
        throw new Error(`JSON pointer does not match the document at "${path}"`);
      }
      value = parentValue[index];
    } else {
      value = (parentValue as Record<string, unknown>)[path];
    }

    if (value === undefined) {
      throw new Error(`JSON pointer does not match the document at "/${paths.join("/")}"`);
    }

    if (Array.isArray(selectedParent)) {
      const index = Number(path);
      selectedValue = selectedParent[index];
      if (selectedValue === undefined) {
        if (Array.isArray(value)) {
          selectedValue = [];
          arrays.push(selectedValue as unknown[]);
        } else if (value !== null && typeof value === "object") {
          selectedValue = createInitialSelection(value as Record<string, unknown>);
        } else {
          selectedValue = undefined;
        }
        selectedParent[index] = selectedValue;
      }
    } else {
      selectedValue = selectedParent[path];
      if (selectedValue === undefined) {
        if (Array.isArray(value)) {
          selectedValue = [];
          arrays.push(selectedValue as unknown[]);
        } else if (value !== null && typeof value === "object") {
          selectedValue = createInitialSelection(value as Record<string, unknown>);
        } else {
          selectedValue = undefined;
        }
        selectedParent[path] = selectedValue;
      }
    }
  }

  // Target value selection (§3.4.12 steps 7–11)
  const lastPath = paths[paths.length - 1]!;
  let finalValue: unknown;
  if (value === null || typeof value !== "object") {
    finalValue = value;
  } else if (Array.isArray(value)) {
    finalValue = deepCopy(value);
  } else {
    const base =
      selectedValue && typeof selectedValue === "object" && !Array.isArray(selectedValue)
        ? (selectedValue as Record<string, unknown>)
        : {};
    finalValue = { ...base, ...deepCopy(value as Record<string, unknown>) };
  }

  if (Array.isArray(selectedParent)) {
    selectedParent[Number(lastPath)] = finalValue;
  } else {
    selectedParent[lastPath] = finalValue;
  }
}

function densifyArray(arr: unknown[]): void {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (arr[read] !== undefined) {
      arr[write++] = arr[read];
    }
  }
  arr.length = write;
}

/** §3.4.13 selectJsonLd */
export function selectJsonLd(
  document: VerifiableCredential,
  pointers: string[],
): VerifiableCredential | null {
  if (pointers.length === 0) return null;

  const arrays: unknown[][] = [];
  const selectionDocument = createInitialSelection(document as Record<string, unknown>);

  if ("@context" in document) {
    selectionDocument["@context"] = deepCopy(document["@context"]);
  }

  for (const pointer of pointers) {
    const paths = parsePointer(pointer);
    if (paths.length === 0) {
      throw new Error("Cannot select the root document with an empty JSON pointer");
    }
    selectPaths(
      paths,
      document as Record<string, unknown>,
      selectionDocument,
      arrays,
    );
  }

  for (const arr of arrays) {
    densifyArray(arr);
  }

  return selectionDocument as VerifiableCredential;
}

export function filterCredential(
  vc: VerifiableCredential,
  renderProperty: string[] | undefined,
): VerifiableCredential {
  // Spec: if renderProperty is not present, the entire verifiable credential is used.
  if (renderProperty == null) {
    return deepCopy(vc);
  }
  const selected = selectJsonLd(vc, renderProperty);
  if (selected == null) {
    throw new Error("selectJsonLd produced no selection from renderProperty");
  }
  return selected;
}
