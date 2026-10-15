import { verifyDigestMultibase } from "./digest";
import type { TemplateReference } from "./types";

export type ResolvedTemplate = {
  html: string;
  source: string;
  mediaType?: string;
  digestVerified: boolean;
};

function decodeDataUrl(url: string): { mediaType: string; body: string } {
  // data:[<mediatype>][;base64],<data>
  const match = /^data:([^,]*?),(.*)$/s.exec(url);
  if (!match) throw new Error("Invalid data: URL");
  const meta = match[1] ?? "";
  const data = match[2] ?? "";
  const isBase64 = /;base64$/i.test(meta);
  const mediaType = meta.replace(/;base64$/i, "") || "text/plain";
  const body = isBase64 ? atob(data) : decodeURIComponent(data);
  return { mediaType, body };
}

/**
 * Resolve `renderMethod.template` — string (often a data: URL) or map with `id`.
 * When `digestMultibase` is present, content is verified before return.
 */
export async function resolveTemplate(
  template: string | TemplateReference | undefined,
  options: { digestMultibase?: string } = {},
): Promise<ResolvedTemplate> {
  if (template == null) {
    throw new Error("renderMethod.template is required for the html render suite");
  }

  if (typeof template === "string") {
    if (template.startsWith("data:")) {
      const { mediaType, body } = decodeDataUrl(template);
      const digest = options.digestMultibase;
      if (digest) await verifyDigestMultibase(body, digest);
      return {
        html: body,
        source: "data: URL",
        mediaType,
        digestVerified: Boolean(digest),
      };
    }
    return fetchTemplate(template, options.digestMultibase, undefined);
  }

  if (!template.id) {
    throw new Error("template.id is required when template is a map");
  }

  if (template.id.startsWith("data:")) {
    const { mediaType, body } = decodeDataUrl(template.id);
    const digest = template.digestMultibase ?? options.digestMultibase;
    if (digest) await verifyDigestMultibase(body, digest);
    return {
      html: body,
      source: "data: URL (template.id)",
      mediaType: template.mediaType ?? mediaType,
      digestVerified: Boolean(digest),
    };
  }

  return fetchTemplate(
    template.id,
    template.digestMultibase ?? options.digestMultibase,
    template.mediaType,
  );
}

function withBase(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const base = import.meta.env.BASE_URL || "/";
  const cleaned = path.replace(/^\//, "");
  return base.endsWith("/") ? base + cleaned : `${base}/${cleaned}`;
}

async function fetchTemplate(
  url: string,
  digestMultibase: string | undefined,
  mediaType: string | undefined,
): Promise<ResolvedTemplate> {
  // Host MUST preload remote templates (CSP frame-src 'none' forbids iframe src).
  // Prefix app base so GitHub Pages project sites resolve /templates/... correctly.
  const fetchUrl = withBase(url);
  let response: Response;
  try {
    response = await fetch(fetchUrl, { mode: "cors", credentials: "omit" });
  } catch (err) {
    throw new Error(
      `Failed to fetch template ${fetchUrl}: ${err instanceof Error ? err.message : String(err)}. ` +
        `Serve templates locally (e.g. /templates/...) or embed as a data: URL.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Template fetch failed (${response.status}) for ${fetchUrl}`);
  }
  const body = await response.text();
  if (digestMultibase) {
    await verifyDigestMultibase(body, digestMultibase);
  }
  return {
    html: body,
    source: fetchUrl,
    mediaType: mediaType ?? response.headers.get("content-type") ?? undefined,
    digestVerified: Boolean(digestMultibase),
  };
}
