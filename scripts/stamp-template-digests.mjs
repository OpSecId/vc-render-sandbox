/**
 * Compute digestMultibase for every templates/*.html and stamp into credentials.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templatesDir = path.join(root, "templates");
const credentialsDir = path.join(root, "credentials");

function digestMultibase(content) {
  const hash = createHash("sha256").update(content).digest();
  const mh = Buffer.concat([Buffer.from([0x12, 0x20]), hash]);
  return `u${mh.toString("base64url")}`;
}

const digests = new Map();
for (const name of fs.readdirSync(templatesDir)) {
  if (!name.endsWith(".html")) continue;
  const body = fs.readFileSync(path.join(templatesDir, name));
  const d = digestMultibase(body);
  digests.set(name, d);
  console.log(name, d);
}

function stampFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return false;
  }
  let changed = false;

  const visitRm = (rm) => {
    if (!rm || typeof rm !== "object") return;
    const t = rm.template;
    if (!t || typeof t !== "object" || typeof t.id !== "string") return;
    const base = t.id.split("/").pop()?.split("?")[0];
    if (!base || !digests.has(base)) return;
    const next = digests.get(base);
    if (t.digestMultibase !== next) {
      t.digestMultibase = next;
      changed = true;
    }
    if (t.mediaType == null) {
      t.mediaType = "text/html";
      changed = true;
    }
  };

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if ("renderMethod" in node) {
      const rm = node.renderMethod;
      if (Array.isArray(rm)) rm.forEach(visitRm);
      else visitRm(rm);
    }
    for (const v of Object.values(node)) walk(v);
  };

  walk(data);
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
  return changed;
}

function walkDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkDir(p);
    else if (name.endsWith(".json")) {
      const c = stampFile(p);
      if (c) console.log("stamped", path.relative(root, p));
    }
  }
}

walkDir(credentialsDir);
console.log("done");
