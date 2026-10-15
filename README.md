# VC Render Sandbox

Sample **host page** for the W3C [VC Render Method](https://www.w3.org/TR/vc-render-method/) **`html` suite**, plus an experimental **host-mediated links** extension profile (not in the TR) for UNTP-style credential graph traversal without giving the template network or top-navigation.

## Quick start

```bash
npm install
npm run digests    # stamp template digestMultibase into credentials
npm run dev
```

Open http://localhost:5173

- **Demo** (`#demo`) — UNTP cathode graph / simple passport / drop JSON
- **Strict** (header toggle, default on) — require template digests; consent on cross-origin follow
- **Doc** (`#doc`) — extension draft

## Profiles

| Profile | What it is |
|---------|------------|
| HTML suite host | `sandbox="allow-scripts"`, `frame-src 'none'`, `srcdoc` + digest check, MessageChannel `renderMethodReady`, `selectJsonLd` filtering |
| Host-mediated links (extension) | `renderMethodFollow` over the same MessageChannel; only `linkURL` values; host fetches; cross-origin consent |

Templates MUST still call `renderMethodReady()`. If `renderMethodFollow` is missing, link controls SHOULD degrade (this demo’s templates check for the function).

## Host hardening (this sandbox)

- Follow allowlist = property name `linkURL` only (not every `https://` string)
- Per-page CSP **nonce** on parent + stamped onto wrapper/template scripts (no `'unsafe-inline'` for scripts)
- Wrapper CSP blocks network; rejects `<html>/<head>/<body>` and remote `<script src>`
- Strict mode: remote/embedded templates require verifying `digestMultibase`
- Cross-origin follow: modal consent (Allow once / Allow origin for session / Deny)
- Followed document must be JSON with `type` including `VerifiableCredential`

## UNTP copper cathode graph

Built from [UNTP v0.8.0 samples](https://untp.unece.org/artefacts/samples/v0.8.0/) into `credentials/untp/` with ported `SuiteRenderMethod` / `html`. Overlay: absolute Pages `linkURL` / `template.id` + digests (`npm run digests`).

| Node | File |
|------|------|
| Entry DPP (cathode) | `credentials/untp/dpp-cathode.json` |
| Conformity (SCSA) | `credentials/untp/dcc-cathode-scheme.json` |
| Facility (smelter / mine) | `dfr-smelter.json`, `dfr-mine.json` |
| Corporate / identity / DTE | `dcr-*.json`, `dia-*.json`, `dte-*.json` |

```bash
npm run demo:untp   # regenerate from /tmp/untp-samples (optional)
npm run digests     # refresh digestMultibase after template edits
```

## GitHub Pages

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml) — CI sets `VITE_BASE=/<repo>/`.

## Spec notes

See [docs/html-host-mediated-links.md](docs/html-host-mediated-links.md) for the extension. HTML suite MUSTs: [HTML Template Processing](https://www.w3.org/TR/vc-render-method/#html-template-processing).

**Not claimed:** Oblivious HTTP; full VC-DI test-vector parity for every `selectJsonLd` edge case; that host-mediated links are in the W3C TR.
