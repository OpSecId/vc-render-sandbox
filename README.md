# VC Render Sandbox

Sample host page for [W3C Verifiable Credential Rendering Methods](https://www.w3.org/TR/vc-render-method/), focused on the **`html` render suite**, plus an experimental **host-mediated links** extension (UNTP credential-graph traversal without template phone-home).

## Quick start

```bash
npm install
npm run demo:untp   # rebuild local UNTP graph from cached/official samples (optional)
npm run dev
```

Open http://localhost:5173

- **Demo** → **Start UNTP cathode demo** — walk DPP → DCC / facility / traceability / corporate / identity
- **Doc** — in-app extension draft ([source](docs/html-host-mediated-links.md))

## UNTP copper cathode graph

Built from [UNTP v0.8.0 samples](https://untp.unece.org/artefacts/samples/v0.8.0/) into `credentials/untp/` with ported `SuiteRenderMethod` / `html` and remapped `relatedDocument` links for same-origin host follow:

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
| Host fetch | Same-origin credential JSON only in this sandbox |

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

## Spec notes

- Template must call `window.renderMethodReady()`.
- Host CSP needs `script-src` `'unsafe-inline'` (or nonce) because browsers enforce parent CSP on `about:srcdoc`.
- Wrapper CSP remains `default-src data: 'unsafe-inline'` (no template network).

## Build

```bash
npm run build
npm run preview
```
