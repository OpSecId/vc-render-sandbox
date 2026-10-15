# VC Render Sandbox

Sample host page for [W3C Verifiable Credential Rendering Methods](https://www.w3.org/TR/vc-render-method/), focused on the **`html` render suite**, plus an experimental **host-mediated links** extension (UNTP credential-graph traversal without template phone-home).

## Quick start

```bash
npm install
npm run demo:untp   # rebuild local UNTP graph from cached/official samples (optional)
npm run dev
```

Open http://localhost:5173

- **Demo** (`#demo`) → **Start UNTP cathode demo** — walk DPP → DCC / facility / traceability / corporate / identity
- **Doc** (`#doc`) — in-app extension draft ([source](docs/html-host-mediated-links.md)); deep link: https://opsecid.github.io/vc-render-sandbox/#doc

## UNTP copper cathode graph

Built from [UNTP v0.8.0 samples](https://untp.unece.org/artefacts/samples/v0.8.0/) into `credentials/untp/` with ported `SuiteRenderMethod` / `html`. **`relatedDocument.linkURL` and `template.id` are absolute GitHub Pages URLs** (e.g. `https://opsecid.github.io/vc-render-sandbox/credentials/untp/…`), so host-mediated follow uses real hosted links.

| Node | File |
|------|------|
| Entry DPP (cathode) | `credentials/untp/dpp-cathode.json` |
| Conformity (SCSA) | `credentials/untp/dcc-cathode-scheme.json` |
| Facility (smelter / mine) | `dfr-smelter.json`, `dfr-mine.json` |
| Corporate record | `dcr-refinery.json` |
| Identity anchors | `dia-smelter.json`, `dia-mine.json` |
| Traceability events | `dte-*.json` |
| Upstream concentrate DPP | `dpp-concentrate.json` |

Regenerate (requires samples under `/tmp/untp-samples` or re-download in the script workflow):

```bash
npm run demo:untp
```

## Host-mediated links

See **Doc** in the app or [docs/html-host-mediated-links.md](docs/html-host-mediated-links.md).

| API | Role |
|-----|------|
| `window.renderMethodFollow({ href, linkType?, label? })` | Template asks host to open a link (no iframe `fetch` / top-nav) |
| Host allowlist | `href` MUST appear in the filtered credential |
| Host fetch | Asserted `https:` URLs (any origin; target must allow CORS). `http://localhost` for local dev. |

## GitHub Pages

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml)

1. Push to `main` (or run the workflow manually)
2. In the repo: **Settings → Pages → Source: GitHub Actions**
3. Site URL: `https://<user>.github.io/<repo>/`

CI sets `VITE_BASE=/<repo>/` so assets and `/credentials/...` fetches resolve under the project path.

Local production check with a Pages-like base:

```bash
VITE_BASE=/vc-render-sandbox/ npm run build
npx vite preview --base /vc-render-sandbox/
```

## Project layout

| Path | Role |
|------|------|
| `credentials/untp/` | UNTP demo graph |
| `templates/Untp*.html` | HTML suite fragments for UNTP types |
| `docs/html-host-mediated-links.md` | Extension draft (also in-app **Doc**) |
| `src/html/` | Host page + wrapper |
| `.github/workflows/pages.yml` | Pages deploy |

## Spec notes (HTML suite)

Implements the [HTML Template Processing](https://www.w3.org/TR/vc-render-method/#html-template-processing) host/wrapper algorithm:

- `iframe` `sandbox="allow-scripts"` only; host CSP includes `frame-src 'none'` (templates via `srcdoc` after preload)
- Wrapper CSP `default-src data: 'unsafe-inline'`; credential data block `type="application/vc"`
- Ready/error over `MessageChannel` + `window.renderMethodReady()`
- `renderProperty` filtering via VC-DI-ECDSA `selectJsonLd` (missing pointers error)
- `digestMultibase` verified when present (`u` + SHA-256 multihash)
- Template fragments MUST NOT include `<html>` / `<head>` / `<body>`

**Extension (not in the W3C TR):** `window.renderMethodFollow` for host-mediated links — see Doc tab.

**SHOULD not implemented here:** Oblivious HTTP / privacy relay for template fetches.

**Host CSP note:** parent `script-src` needs `'unsafe-inline'` (or a nonce/hash) because browsers also enforce the parent CSP on `about:srcdoc`.

## Build

```bash
npm run build
npm run preview
```
