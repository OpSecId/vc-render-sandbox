# Host-Mediated Links for the HTML Render Suite

**Status:** Experimental extension draft (non-normative relative to W3C)  
**Applies to:** [Verifiable Credential Rendering Methods](https://www.w3.org/TR/vc-render-method/) — `html` render suite  
**Implements in:** this repository (`vc-render-sandbox`)  
**Motivation:** UNTP credential-graph traversal (e.g. Digital Product Passport → Digital Conformity Credential) without weakening the HTML suite privacy model

---

## 1. Abstract

The W3C `html` render suite confines issuer-supplied template code in a sandboxed iframe so that rendering cannot navigate the host, load remote content, or otherwise “phone home.” That confinement is essential for credentials about people.

Trade and supply-chain credentials have an additional requirement: a consumer must be able to **follow issuer-asserted links** from a rendered passport (or facility record, traceability event, etc.) to a related verifiable credential and inspect that evidence.

This document defines a small extension to the HTML suite host ↔ template channel: **host-mediated links**. The template may *propose* opening a URI that already appears in the credential data provided to it; the **host page** validates the request and performs any retrieval or navigation outside the sandbox.

The template never gains network access or top-level navigation capability.

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
| Wrapper CSP | `default-src data: 'unsafe-inline'` (no network from template) |
| Ready / error | Template signals completion via `renderMethodReady` over a `MessageChannel` |

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
| `href` | string | Yes | URI to open; MUST be an asserted URI |
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

1. If `req.href` is not an asserted URI in `filtered`, **reject** the request. Emit a host-visible error or log; do not fetch.
2. If the request is not associated with a user gesture that the host accepts for navigation, **reject** or queue for confirmation (host policy).
3. Classify the target (host policy), for example:
   - **credential follow** — media type / path indicates a VC JSON document; host retrieves and may render it
   - **non-credential** — HTML page, PDF, etc.; host MAY show metadata only, open with an explicit external-open UX, or refuse
4. For credential follow:
   1. Retrieve the document under host control (not inside the template iframe). Any origin is allowed at the protocol level; this sandbox fetches asserted `https:` URLs (and `http://localhost` for local dev). The browser still enforces CORS on the target.
   2. Verify it as required by the host (signature, status, type).
   3. Present it (new renderMethod pass, stack navigation, split pane, etc.).
5. Hosts SHOULD apply privacy-preserving retrieval for remote resources (e.g. disassociating relays / Oblivious HTTP as already suggested for template fetches in the base specification).

### 6.3 Asserted URI check

An implementation MUST treat `href` as asserted only if it equals a string value found by walking the filtered credential JSON (or an explicitly declared allowlist derived from that walk before injection).

Hosts MUST NOT accept URLs that appear only in template code or only in unfiltered credential fields withheld by `renderProperty`.

> This sandbox walks string values matching a URI-like pattern (`http(s):`, `/`, `did:`, `urn:`, `data:`).

---

## 7. Security and privacy considerations

### 7.1 Preserved threat mitigations

| Threat (from VC Render Method threat model) | Mitigation with this extension |
|---------------------------------------------|-------------------------------|
| Template phones home / tracks the holder | Template still has no network (wrapper CSP) |
| Template navigates the wallet away | No `allow-top-navigation*`; only host may navigate/fetch |
| Template invents tracking URLs | Asserted-URI allowlist rejects non-credential URLs |

### 7.2 Residual risks (host responsibilities)

- **Host fetch as tracker:** a malicious or compromised host could still request asserted URLs (including cross-origin). Users trust the host/wallet; this extension does not change that trust boundary.
- **CORS / availability:** cross-origin credential stores must allow the host origin (or use a host-side proxy). A failed CORS preflight is a deployment concern, not a template escape.
- **Asserted phishing URLs:** an issuer can place a malicious URL in the credential. The allowlist only proves the issuer asserted it; hosts SHOULD show clear UX (label, domain, type) before leaving the current credential.
- **Confused deputy:** hosts MUST NOT treat `followLink` as proof that the target is a VC; validate media type / document shape before rendering as a credential.
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
      "mediaType": "text/html"
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
if (!isAssertedLink(filteredCredential, request.href)) {
  // reject — template attempted a non-asserted URL
  return;
}
const next = await fetchCredentialJson(request.href); // host-controlled
openCredential(next);
```

---

## 10. Conformance classes

**Conforming template (host-mediated links)**  
A template that uses `renderMethodFollow` only with asserted URIs and never performs its own network or top-level navigation to follow links.

**Conforming host (host-mediated links)**  
A host that:

1. Implements the HTML suite confinement requirements, and  
2. Accepts `followLink` only for asserted URIs in the filtered credential, and  
3. Performs retrieval / navigation only in host context under user control.

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
| Wrapper bridge | `src/html/wrapper.ts` |
| Host handler + allowlist | `src/html/host.ts`, `src/links.ts` |
| Message shapes | `src/html/messages.ts` |
| Demo UI stack | `src/main.ts` |
| UNTP cathode DPP → DCC | `credentials/untp-dpp-cathode.json` → `credentials/untp-dcc-cathode-scheme.json` |

---

## 13. References

- [Verifiable Credential Rendering Methods v1.0](https://www.w3.org/TR/vc-render-method/) (W3C Working Draft)
- [HTML `iframe` `sandbox`](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [UNTP Digital Product Passport](https://untp.unece.org/docs/specification/product-passport)
- [UNTP Digital Conformity Credential](https://untp.unece.org/docs/specification/conformity-credential)
