/** Minimal RFC 6901 JSON Pointer helpers. */

export function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new Error(`JSON Pointer must start with "/": ${pointer}`);
  }
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function getByPointer(doc: unknown, pointer: string): unknown {
  const tokens = parsePointer(pointer);
  let cur: unknown = doc;
  for (const token of tokens) {
    if (cur == null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= cur.length) {
        return undefined;
      }
      cur = cur[index];
    } else {
      cur = (cur as Record<string, unknown>)[token];
    }
  }
  return cur;
}

/** Deep-set a value at a JSON Pointer path, creating objects along the way. */
export function setByPointer(
  doc: Record<string, unknown>,
  pointer: string,
  value: unknown,
): void {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    throw new Error("Cannot replace the root document via setByPointer");
  }

  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1]!;
    const existing = cur[token];
    if (existing == null || typeof existing !== "object" || Array.isArray(existing)) {
      cur[token] = /^\d+$/.test(next) ? [] : {};
    }
    cur = cur[token] as Record<string, unknown>;
  }
  cur[tokens[tokens.length - 1]!] = value;
}
