# Host-Mediated Links for the HTML Render Suite

**Status:** Experimental extension draft (non-normative relative to W3C)  
**Applies to:** [Verifiable Credential Rendering Methods](https://www.w3.org/TR/vc-render-method/) — `html` render suite  
**Implements in:** this repository (`vc-render-sandbox`)  
**Motivation:** UNTP credential-graph traversal (e.g. Digital Product Passport → Digital Conformity Credential) without weakening the HTML suite privacy model

---

## 1. Abstract

The W3C `html` render suite confines issuer-supplied template code in a sandboxed iframe so that rendering cannot navigate the host, load remote content, or otherwise “phone home.” That confinement is essential for credentials about people.

Trade and supply-chain credentials have an additional requirement: a consumer must be able to **follow issuer-asserted links** from a rendered passport (or facility record, traceability event, etc.) to a related verifiable credential and inspect that evidence.

This document defines a small **extension profile** (not part of the W3C TR) on top of a conformant HTML suite host: **host-mediated links**. The template may *propose* opening a URI that appears as a `linkURL` property in the filtered credential; the **host page** validates the request, obtains user consent before fetch (this sandbox always; production hosts MAY skip same-origin), and performs any retrieval outside the sandbox.

The template never gains network access or top-level navigation capability. Wallets that implement only the TR need not implement `renderMethodFollow`; templates SHOULD degrade gracefully when it is absent.

---

## 2. Goals and non-goals

### 2.1 Goals

- Preserve the HTML suite security and privacy outcomes:
  - no template-initiated network requests
  - no top-level browsing-context navigation by the template
  - no access to the host page DOM / storage
- Enable **user-initiated** traversal of issuer-asserted credential links (UNTP `relatedDocument`, evidence links, and similar).
- Reuse the existing ready/error communication pattern between host and wrapper.

### 2.2 Non-goals

- Defining a new `renderSuite` value (this is an extension of `html`).
- Replacing selective disclosure, OID4VP, or wallet presentation protocols.
- Requiring Oblivious HTTP or any specific host fetch privacy technology (hosts SHOULD apply privacy-preserving retrieval where appropriate).
- Allowing arbitrary URLs invented by template code.

---

## 3. Terminology

Terms from [VC Render Method](https://www.w3.org/TR/vc-render-method/) apply: *host page*, *template code*, *wrapper code*, *filtered verifiable credential*.

**asserted URI**  
A URI string that appears in the filtered verifiable credential provided to the template (including nested objects such as UNTP `Link.linkURL`).

**host-mediated link request**  
A message from template code to the host page asking the host to open an asserted URI on the user’s behalf.

**credential follow**  
A host-mediated link request whose target is expected to be a verifiable credential document (typically JSON / JSON-LD) that the host may render with a render method.

---

## 4. Relationship to the HTML render suite

This extension does **not** change:

| Requirement | Still required |
|-------------|----------------|
| iframe `sandbox` | `allow-scripts` only (no `allow-top-navigation*`, no `allow-same-origin`) |
| Host CSP | `frame-src 'none'` (templates via `srcdoc` after preload / digest check) |
| Wrapper CSP | no network (`default-src data:`); scripts only with host nonce |
| Ready / error | Template signals completion via `renderMethodReady` over a `MessageChannel` |
| Template integrity | Strict mode requires `digestMultibase` and verifies before `srcdoc` inject |

It **adds** an optional request channel from template → host for link traversal (same `MessageChannel` port after `ready`).

> **Note (browser CSP):** Browsers also enforce the *parent* document CSP on `about:srcdoc` documents. Host pages that set `script-src` without `'unsafe-inline'` (or a nonce/hash covering wrapper and template scripts) will block template execution entirely. That is a host CSP authoring concern, not a relaxation of wrapper CSP.

---

## 5. API surface

### 5.1 Template API

The wrapper MUST expose:

```js
window.renderMethodFollow(request)
```

where `request` is a map:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `href` | string | Yes | URI to open; MUST equal a `linkURL` value in the filtered credential |
| `linkType` | string | No | Hint (e.g. UNTP `linkType`, `conformityEvidence`) |
| `label` | string | No | Human-readable label for host UX |

The template MUST NOT:

- call `fetch` / `XMLHttpRequest` / navigate `top` / open popups to follow links
- pass a `href` that does not appear in the credential data block

Calling `renderMethodFollow` only enqueues a message to the host; it does not itself retrieve the resource.

### 5.2 Host message

This sandbox extends the HTML suite `MessageChannel` (the same port used for `ready` / `error`). After the host transfers `port2` into the wrapper, follow requests are sent on that port as:

```json
{
  "type": "followLink",
  "href": "https://example.example/credentials/dcc.json",
  "linkType": "https://test.uncefact.org/vocabulary/link-type/dcc",
  "label": "View conformity credential"
}
```

Hosts MUST ignore messages that are not from the active mount’s `MessagePort`.

### 5.3 Ready API (unchanged semantics)

```js
window.renderMethodReady()
window.renderMethodReady(new Error("…"))
```

---

## 6. Algorithms

### 6.1 Template: request a host-mediated link

1. Let `credential` be the object parsed from the credential data block.
2. Let `href` be the URI chosen for the user action (e.g. from `relatedDocument[i].linkURL`).
3. If `href` is not present as a string value somewhere in `credential`, abort (template SHOULD not offer the control).
4. On user activation (click / equivalent), call `renderMethodFollow({ href, linkType?, label? })`.

### 6.2 Host: handle a host-mediated link request

Inputs: active filtered credential `filtered`, request `req`.

1. If `req.href` is not a followable `linkURL` in `filtered`, **reject** the request. Emit a host-visible error or log; do not fetch.
2. **Obtain user consent** (or use a prior session approval for that origin) before fetching. This sandbox prompts for every followLink — including same-origin — so the consent UX is visible on GitHub Pages demos; production hosts MAY skip same-origin.
3. Classify the target (host policy), for example:
   - **credential follow** — JSON document with `type` including `VerifiableCredential`; host retrieves and may render it
   - **non-credential** — HTML page, PDF, etc.; this sandbox **refuses** (does not open as a credential)
4. For credential follow:
   1. Retrieve the document under host control (not inside the template iframe). Schemes: `https:` (any origin) or `http://localhost` / `127.0.0.1`. CORS still applies.
   2. Require VC shape (`type` includes `VerifiableCredential`). Further proof/status checks are host policy.
   3. Present it (new renderMethod pass, stack navigation, etc.).
5. Hosts SHOULD apply privacy-preserving retrieval for remote resources (e.g. Oblivious HTTP).

### 6.3 Followable `linkURL` check

An implementation MUST treat `href` as followable only if it equals a string value of a property named **`linkURL`** in the filtered credential JSON (UNTP `Link` / evidence Link). Other URI-shaped strings (`issuer.id`, scheme ids, etc.) MUST NOT be followable.

Hosts MUST NOT accept URLs that appear only in template code or only in unfiltered credential fields withheld by `renderProperty`.

> This sandbox also rejects `javascript:`, `data:`, `blob:`, and `file:` schemes for follow.

---

## 7. Security and privacy considerations

### 7.1 Preserved threat mitigations

| Threat (from VC Render Method threat model) | Mitigation with this extension |
|---------------------------------------------|-------------------------------|
| Template phones home / tracks the holder | Template still has no network (wrapper CSP) |
| Template navigates the wallet away | No `allow-top-navigation*`; only host may navigate/fetch |
| Template invents tracking URLs | Only `linkURL` property values in the filtered VC are followable |

### 7.2 Residual risks (host responsibilities)

- **Host fetch as tracker:** a malicious or compromised host could still request asserted URLs (including cross-origin). Users trust the host/wallet; this extension does not change that trust boundary.
- **CORS / availability:** cross-origin credential stores must allow the host origin (or use a host-side proxy). A failed CORS preflight is a deployment concern, not a template escape.
- **Issuer phishing URLs:** an issuer can place a malicious `linkURL` in the credential. The allowlist only proves it was disclosed as a Link; hosts SHOULD show clear UX (label, domain, type) and obtain consent before cross-origin fetch.
- **Confused deputy:** hosts MUST NOT treat `followLink` as proof that the target is a VC; this sandbox requires JSON with `type` including `VerifiableCredential` before stacking a render.
- **Over-broad `renderProperty`:** exposing more URIs than needed expands what templates may request; issuers SHOULD minimize `renderProperty` (or equivalent) to the claims required for the template.

### 7.3 What this extension explicitly rejects

Granting the iframe `allow-top-navigation`, `allow-top-navigation-by-user-activation`, or `allow-top-navigation-to-custom-protocols` would reintroduce wallet hijack and is **incompatible** with this extension’s model.

---

## 8. UNTP applicability

UNTP credentials (DPP, DCC, DFR, DCR, DTE, DIA) routinely carry typed links such as:

- `relatedDocument[].linkURL`
- claim / evidence links
- facility and identity references

A typical consumer journey:

1. Scan / open a **Digital Product Passport**
2. Inspect performance claims in the HTML render
3. Activate “View conformity credential”
4. Host validates `linkURL` ∈ filtered DPP, fetches the **Digital Conformity Credential**, renders it

The same pattern applies to facility records, corporate records, identity anchors, and traceability events once their link fields are present in the filtered credential.

Published UNTP samples may omit `renderMethod` today. Deployments can attach a `SuiteRenderMethod` with `renderSuite: "html"` without changing the underlying UNTP subject model.

---

## 9. Example

### 9.1 Credential (excerpt)

```json
{
  "type": ["VerifiableCredential", "DigitalProductPassport"],
  "renderMethod": {
    "type": "SuiteRenderMethod",
    "renderSuite": "html",
    "renderProperty": [
      "/credentialSubject/name",
      "/credentialSubject/relatedDocument"
    ],
    "template": {
      "id": "https://opsecid.github.io/vc-render-sandbox/templates/UntpDigitalProductPassport.html",
      "mediaType": "text/html",
      "digestMultibase": "uEiB…SHA-256-multihash…"
    }
  },
  "credentialSubject": {
    "name": "LME Grade A Copper Cathode",
    "relatedDocument": [
      {
        "linkURL": "https://opsecid.github.io/vc-render-sandbox/credentials/untp/dcc-cathode-scheme.json",
        "linkName": "SCSA Responsible Cathode Production Attestation",
        "linkType": "https://test.uncefact.org/vocabulary/link-type/dcc",
        "mediaType": "application/ld+json"
      }
    ]
  }
}
```

### 9.2 Template (excerpt)

```js
button.onclick = () => {
  window.renderMethodFollow({
    href: doc.linkURL,
    linkType: doc.linkType,
    label: doc.linkName
  });
};
```

### 9.3 Host (excerpt)

```js
if (!isFollowableLink(filteredCredential, request.href)) {
  // reject — not a linkURL in the filtered credential
  return;
}
if (crossOrigin(request.href)) await confirmWithUser(request);
const next = await fetchCredentialJson(resolveFetchUrl(request.href)); // host-controlled
assertVerifiableCredentialShape(next);
openCredential(next);
```

---

## 10. Conformance classes

**Conforming template (host-mediated links)**  
A template that uses `renderMethodFollow` only with `linkURL` values from the credential data block and never performs its own network or top-level navigation to follow links. Templates SHOULD degrade if `renderMethodFollow` is undefined.

**Conforming host (host-mediated links)**  
A host that:

1. Implements the HTML suite confinement requirements, and  
2. Accepts `followLink` only for `linkURL` values in the filtered credential, and  
3. Performs retrieval only in host context under user control (consent before fetch), and  
4. Does not render a follow target as a credential unless it has VC shape.

---

## 11. Proposed upstream text (sketch)

A future revision of VC Render Method could add, under HTML Template Processing:

> The wrapper MAY expose `window.renderMethodFollow(request)` …  
> The host page MUST reject requests whose `href` is not present in the filtered verifiable credential …  
> The host page MUST perform any retrieval outside the sandboxed iframe …

Until such text exists, implementers may treat this document as an optional profile of the `html` suite.

---

## 12. Reference implementation

| Piece | Location in this repo |
|-------|------------------------|
| Wrapper bridge + nonce CSP | `src/html/wrapper.ts` |
| Host handler | `src/html/host.ts` |
| Followable `linkURL` allowlist | `src/links.ts` |
| Strict / consent policy | `src/host-policy.ts` |
| Pages → local fetch rewrite | `src/demo-urls.ts` |
| Message shapes | `src/html/messages.ts` |
| Demo UI | `src/main.ts` |
| Stamp digests | `npm run digests` → `scripts/stamp-template-digests.mjs` |
| UNTP graph | `credentials/untp/dpp-cathode.json` → related `credentials/untp/*.json` |

---

## 13. Revisions

### R1 — Initial extension draft

- Defined `renderMethodFollow` / host-mediated links over the HTML suite channel.
- Demo UNTP graph with absolute Pages `linkURL` values.
- Early transport used `parent.postMessage` + handshake id (later replaced).

### R2 — HTML suite algorithm alignment

- MessageChannel for `ready` / `error` / `followLink` (TR host/wrapper algorithm).
- `selectJsonLd`-style filtering; missing pointers fail closed.
- Entire VC when `renderProperty` is absent.
- Reject template fragments containing `<html>` / `<head>` / `<body>`.

### R3 — Host hardening (current)

Addressed threat-model and “soft allowlist” gaps from review:

| Hardening | Behavior |
|-----------|----------|
| **`linkURL`-only allowlist** | Follow targets must equal a `linkURL` property in the filtered VC — not every URI-shaped string (`issuer.id`, subject ids, etc.). |
| **Strict mode** (default on) | Remote/embedded templates **require** `digestMultibase`; host verifies SHA-256 multihash (`u` prefix) before `srcdoc` inject. Toggle off only for demo of unsigned templates. |
| **Follow consent** | Before host fetch of an asserted `linkURL`, show label / origin / URL / `linkType` and require Deny / Allow once / Allow origin (session). Keys off the **asserted** URL (not a local mirror). This sandbox prompts even for same-origin so Pages demos surface the UX. |
| **CSP nonce** | Per-page nonce installed before app load; wrapper + template `<script>` tags stamped with the same nonce. Parent `script-src` is `'self' 'nonce-…'` (no script `'unsafe-inline'`). Wrapper CSP blocks network (`default-src data:`). |
| **Template hygiene** | Reject remote `<script src>` in fragments. |
| **VC shape on follow** | Followed JSON must include `type` `VerifiableCredential` before stack/render. |
| **Local mirror for digests** | Asserted Pages URLs for this app may be fetched from the local stamped tree after consent so Strict digests work before Pages redeploy; debug log notes the mirror. |
| **Profile framing** | Documented as HTML suite host **plus** optional extension — not a claim that `renderMethodFollow` is in the W3C TR. |

Follow consent and the `linkURL` allowlist remain on even when Strict is off. Strict only gates **template digest** requirement.

### R4 — Same-origin follow consent (demo)

- Host prompts on every `followLink` (not only cross-origin) so GitHub Pages demos show the modal; session **Allow origin** still skips repeats.
- **New** clears session origin approvals.

---

## 14. References

- [Verifiable Credential Rendering Methods v1.0](https://www.w3.org/TR/vc-render-method/) (W3C Working Draft)
- [HTML `iframe` `sandbox`](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [Channel Messaging API (`MessageChannel`)](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)
- [UNTP Digital Product Passport](https://untp.unece.org/docs/specification/DigitalProductPassport)
- [UNTP Digital Conformity Credential](https://untp.unece.org/docs/specification/DigitalConformityCredential)
