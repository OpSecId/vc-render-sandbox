import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Project Pages: set VITE_BASE=/repo-name/ in CI. Local/dev defaults to "/". */
const base = process.env.VITE_BASE || "/";

function contentTypeFor(file: string): string {
  const ext = path.extname(file);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  return "application/octet-stream";
}

function safeResolveUnder(dir: string, relativePath: string): string | null {
  if (!relativePath || relativePath.includes("\0")) return null;
  const resolved = path.resolve(dir, relativePath);
  if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
    return null;
  }
  return resolved;
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) {
      copyDirRecursive(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

/** Serve and ship static demo assets (supports one-level nesting, e.g. credentials/untp/). */
function serveStaticDirs(dirs: string[]): Plugin {
  return {
    name: "serve-static-dirs",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let url = req.url?.split("?")[0] ?? "";
        // When VITE_BASE is set (e.g. /repo/), strip it for local asset lookup.
        const normalizedBase = base === "/" ? "/" : base.replace(/\/?$/, "/");
        if (normalizedBase !== "/" && url.startsWith(normalizedBase)) {
          url = "/" + url.slice(normalizedBase.length);
        }
        for (const dir of dirs) {
          const prefix = `/${dir}/`;
          if (!url.startsWith(prefix)) continue;
          const rel = decodeURIComponent(url.slice(prefix.length));
          if (!rel || rel.includes("..")) return next();
          const file = safeResolveUnder(path.join(rootDir, dir), rel);
          if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            return next();
          }
          res.setHeader("Content-Type", contentTypeFor(file));
          fs.createReadStream(file).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      for (const dir of dirs) {
        const src = path.join(rootDir, dir);
        if (!fs.existsSync(src)) continue;
        copyDirRecursive(src, path.join(rootDir, "dist", dir));
      }
    },
  };
}

export default defineConfig({
  root: ".",
  base,
  plugins: [serveStaticDirs(["templates", "credentials", "docs"])],
});
