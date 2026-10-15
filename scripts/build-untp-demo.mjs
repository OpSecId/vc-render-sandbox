/**
 * Build a local UNTP copper-cathode credential graph for host-mediated traversal.
 * Source samples: https://untp.unece.org/artefacts/samples/v0.8.0/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = "/tmp/untp-samples";
const outDir = path.join(root, "credentials", "untp");

/** Public origin where credentials + templates are hosted (GitHub Pages). */
const PUBLIC_BASE = (
  process.env.UNTP_PUBLIC_BASE || "https://opsecid.github.io/vc-render-sandbox"
).replace(/\/$/, "");

const FILES = {
  "dpp-cathode.json": "DigitalProductPassport_cathode_instance.json",
  "dpp-concentrate.json": "DigitalProductPassport_instance.json",
  "dcc-cathode-scheme.json": "ConformityCredential_cathode_scheme_instance.json",
  "dfr-smelter.json": "DigitalFacilityRecord_smelter_instance.json",
  "dfr-mine.json": "DigitalFacilityRecord_instance.json",
  "dcr-refinery.json": "DigitalCorporateRecord_instance.json",
  "dia-smelter.json": "DigitalIdentityAnchor_smelter_instance.json",
  "dia-mine.json": "DigitalIdentityAnchor_mine_instance.json",
  "dte-anodes-to-cathode.json":
    "DigitalTraceabilityEvent_anodes_refined_into_cathode_instance.json",
  "dte-concentrate-to-anodes.json":
    "DigitalTraceabilityEvent_concentrate_smelted_into_anodes_instance.json",
  "dte-concentrate-commissioned.json":
    "DigitalTraceabilityEvent_concentrate_commissioned_at_mine_instance.json",
};

const credentialUrl = (name) => `${PUBLIC_BASE}/credentials/untp/${name}`;
const templateUrl = (name) => `${PUBLIC_BASE}/templates/${name}`;

function link(linkURL, linkName, linkType = "https://test.uncefact.org/vocabulary/link-type/dcc") {
  return {
    linkURL,
    linkName,
    mediaType: "application/ld+json",
    linkType,
  };
}

function htmlMethod(name, templateFile, renderProperty, height = "560px") {
  return {
    type: "SuiteRenderMethod",
    renderSuite: "html",
    name,
    description:
      "Ported to W3C html suite for vc-render-sandbox host-mediated link demo (UNTP v0.8.0 sample).",
    renderProperty,
    template: { id: templateUrl(templateFile), mediaType: "text/html" },
    outputPreference: {
      accessMode: ["visual"],
      mediaType: "text/html",
      style: { width: "100%", height },
    },
  };
}

function setRelated(subject, docs) {
  subject.relatedDocument = docs;
}

function load(key) {
  const file = path.join(srcDir, FILES[key]);
  if (!fs.existsSync(file)) throw new Error(`Missing sample: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

fs.mkdirSync(outDir, { recursive: true });

// --- DPP Cathode (entry) ---
{
  const d = load("dpp-cathode.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(
      credentialUrl("dcc-cathode-scheme.json"),
      "SCSA Responsible Cathode Production Attestation",
      "https://test.uncefact.org/vocabulary/link-type/dcc",
    ),
    link(credentialUrl("dfr-smelter.json"), "Facility record — Sample Copper Refinery", "untp:facility-record"),
    link(
      credentialUrl("dte-anodes-to-cathode.json"),
      "Traceability — anodes refined into this cathode batch",
      "untp:traceability-event",
    ),
    link(credentialUrl("dcr-refinery.json"), "Corporate record — Sample Copper Refinery", "untp:corporate-record"),
    link(credentialUrl("dia-smelter.json"), "Identity anchor — Sample Copper Refinery", "untp:identity-anchor"),
    link(credentialUrl("dpp-concentrate.json"), "Upstream product — Copper concentrate passport", "untp:product-passport"),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Product Passport",
    "UntpDigitalProductPassport.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/modelNumber",
      "/credentialSubject/batchNumber",
      "/credentialSubject/productionDate",
      "/credentialSubject/countryOfProduction",
      "/credentialSubject/dimensions",
      "/credentialSubject/producedAtFacility",
      "/credentialSubject/productCategory",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/materialProvenance",
      "/credentialSubject/performanceClaim",
    ],
    "680px",
  );
  fs.writeFileSync(path.join(outDir, "dpp-cathode.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DPP Concentrate ---
{
  const d = load("dpp-concentrate.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(credentialUrl("dfr-mine.json"), "Facility record — Sample Copper Mine", "untp:facility-record"),
    link(
      credentialUrl("dte-concentrate-commissioned.json"),
      "Traceability — concentrate batch commissioned",
      "untp:traceability-event",
    ),
    link(credentialUrl("dia-mine.json"), "Identity anchor — Sample Copper Mine", "untp:identity-anchor"),
    link(credentialUrl("dpp-cathode.json"), "Downstream product — Copper cathode passport", "untp:product-passport"),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Product Passport",
    "UntpDigitalProductPassport.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/modelNumber",
      "/credentialSubject/batchNumber",
      "/credentialSubject/productionDate",
      "/credentialSubject/countryOfProduction",
      "/credentialSubject/dimensions",
      "/credentialSubject/producedAtFacility",
      "/credentialSubject/productCategory",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/materialProvenance",
      "/credentialSubject/performanceClaim",
    ],
    "680px",
  );
  fs.writeFileSync(path.join(outDir, "dpp-concentrate.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DCC ---
{
  const d = load("dcc-cathode-scheme.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(credentialUrl("dpp-cathode.json"), "Product passport — LME Grade A Copper Cathode", "untp:product-passport"),
    link(credentialUrl("dfr-smelter.json"), "Facility record — Sample Copper Refinery", "untp:facility-record"),
    link(credentialUrl("dcr-refinery.json"), "Corporate record — assessed organisation", "untp:corporate-record"),
    link(credentialUrl("dia-smelter.json"), "Identity anchor — Sample Copper Refinery", "untp:identity-anchor"),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Conformity Credential",
    "UntpConformityCredential.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/assessorLevel",
      "/credentialSubject/assessmentLevel",
      "/credentialSubject/attestationType",
      "/credentialSubject/issuedToParty",
      "/credentialSubject/coverage",
      "/credentialSubject/licensedByScheme",
      "/credentialSubject/conformityCertificate",
      "/credentialSubject/trustmark",
      "/credentialSubject/conformityAssessment",
      "/credentialSubject/relatedDocument",
    ],
    "620px",
  );
  fs.writeFileSync(path.join(outDir, "dcc-cathode-scheme.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DFR Smelter ---
{
  const d = load("dfr-smelter.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(
      credentialUrl("dcc-cathode-scheme.json"),
      "SCSA Responsible Cathode Production Attestation",
      "https://test.uncefact.org/vocabulary/link-type/dcc",
    ),
    link(credentialUrl("dcr-refinery.json"), "Corporate record — Sample Copper Refinery", "untp:corporate-record"),
    link(credentialUrl("dia-smelter.json"), "Identity anchor — Sample Copper Refinery", "untp:identity-anchor"),
    link(credentialUrl("dpp-cathode.json"), "Product passport — Copper cathode", "untp:product-passport"),
    link(
      credentialUrl("dte-anodes-to-cathode.json"),
      "Traceability — electrorefining event",
      "untp:traceability-event",
    ),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Facility Record",
    "UntpFacilityRecord.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/registeredId",
      "/credentialSubject/operatedByParty",
      "/credentialSubject/countryOfOperation",
      "/credentialSubject/address",
      "/credentialSubject/facilityType",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/performanceClaim",
    ],
    "600px",
  );
  fs.writeFileSync(path.join(outDir, "dfr-smelter.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DFR Mine ---
{
  const d = load("dfr-mine.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(credentialUrl("dia-mine.json"), "Identity anchor — Sample Copper Mine", "untp:identity-anchor"),
    link(credentialUrl("dpp-concentrate.json"), "Product passport — Copper concentrate", "untp:product-passport"),
    link(
      credentialUrl("dte-concentrate-commissioned.json"),
      "Traceability — concentrate commissioned",
      "untp:traceability-event",
    ),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Facility Record",
    "UntpFacilityRecord.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/registeredId",
      "/credentialSubject/operatedByParty",
      "/credentialSubject/countryOfOperation",
      "/credentialSubject/address",
      "/credentialSubject/facilityType",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/performanceClaim",
    ],
    "600px",
  );
  fs.writeFileSync(path.join(outDir, "dfr-mine.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DCR ---
{
  const d = load("dcr-refinery.json");
  const s = d.credentialSubject;
  setRelated(s, [
    link(credentialUrl("dia-smelter.json"), "Identity anchor — Sample Copper Refinery", "untp:identity-anchor"),
    link(credentialUrl("dfr-smelter.json"), "Facility record — Sample Copper Refinery", "untp:facility-record"),
    link(credentialUrl("dpp-cathode.json"), "Product passport — Copper cathode", "untp:product-passport"),
    link(
      credentialUrl("dcc-cathode-scheme.json"),
      "SCSA Responsible Cathode Production Attestation",
      "https://test.uncefact.org/vocabulary/link-type/dcc",
    ),
  ]);
  d.renderMethod = htmlMethod(
    "UNTP Digital Corporate Record",
    "UntpCorporateRecord.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/description",
      "/credentialSubject/registeredId",
      "/credentialSubject/registrationCountry",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/performanceClaim",
      "/credentialSubject/alsoKnownAs",
    ],
    "600px",
  );
  fs.writeFileSync(path.join(outDir, "dcr-refinery.json"), JSON.stringify(d, null, 2) + "\n");
}

// --- DIA smelter / mine ---
for (const [outName, templateHeight] of [
  ["dia-smelter.json", "420px"],
  ["dia-mine.json", "420px"],
]) {
  const d = load(outName);
  const s = d.credentialSubject;
  const docs =
    outName === "dia-smelter.json"
      ? [
          link(credentialUrl("dcr-refinery.json"), "Corporate record", "untp:corporate-record"),
          link(credentialUrl("dfr-smelter.json"), "Facility record", "untp:facility-record"),
          link(credentialUrl("dpp-cathode.json"), "Product passport — cathode", "untp:product-passport"),
        ]
      : [
          link(credentialUrl("dfr-mine.json"), "Facility record", "untp:facility-record"),
          link(credentialUrl("dpp-concentrate.json"), "Product passport — concentrate", "untp:product-passport"),
        ];
  setRelated(s, docs);
  d.renderMethod = htmlMethod(
    "UNTP Digital Identity Anchor",
    "UntpIdentityAnchor.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject/id",
      "/credentialSubject/name",
      "/credentialSubject/registeredId",
      "/credentialSubject/idScheme",
      "/credentialSubject/registrationCountry",
      "/credentialSubject/relatedDocument",
      "/credentialSubject/alsoKnownAs",
    ],
    templateHeight,
  );
  fs.writeFileSync(path.join(outDir, outName), JSON.stringify(d, null, 2) + "\n");
}

// --- DTEs ---
for (const [outName, extras] of [
  [
    "dte-anodes-to-cathode.json",
    [
      link(credentialUrl("dpp-cathode.json"), "Output product — cathode passport", "untp:product-passport"),
      link(credentialUrl("dte-concentrate-to-anodes.json"), "Upstream event — concentrate smelted to anodes", "untp:traceability-event"),
      link(credentialUrl("dfr-smelter.json"), "Facility record — refinery", "untp:facility-record"),
    ],
  ],
  [
    "dte-concentrate-to-anodes.json",
    [
      link(credentialUrl("dpp-concentrate.json"), "Input product — concentrate passport", "untp:product-passport"),
      link(credentialUrl("dte-anodes-to-cathode.json"), "Downstream event — anodes refined to cathode", "untp:traceability-event"),
      link(credentialUrl("dte-concentrate-commissioned.json"), "Upstream event — concentrate commissioned", "untp:traceability-event"),
      link(credentialUrl("dfr-smelter.json"), "Facility record — refinery", "untp:facility-record"),
    ],
  ],
  [
    "dte-concentrate-commissioned.json",
    [
      link(credentialUrl("dpp-concentrate.json"), "Product passport — concentrate", "untp:product-passport"),
      link(credentialUrl("dfr-mine.json"), "Facility record — mine", "untp:facility-record"),
      link(credentialUrl("dte-concentrate-to-anodes.json"), "Downstream event — smelted into anodes", "untp:traceability-event"),
    ],
  ],
]) {
  const d = load(outName);
  // Attach graph links at credential top-level helper used by template
  d.relatedDocument = extras;
  d.renderMethod = htmlMethod(
    "UNTP Digital Traceability Event",
    "UntpTraceabilityEvent.html",
    [
      "/name",
      "/issuer/name",
      "/issuer/id",
      "/validFrom",
      "/validUntil",
      "/credentialSubject",
      "/relatedDocument",
    ],
    "560px",
  );
  fs.writeFileSync(path.join(outDir, outName), JSON.stringify(d, null, 2) + "\n");
}

// Manifest for the app
const manifest = {
  title: "UNTP copper cathode supply chain",
  publicBase: PUBLIC_BASE,
  entry: credentialUrl("dpp-cathode.json"),
  entryLabel: "Cathode DPP",
  description:
    "Host-mediated traversal across UNTP v0.8.0 samples: DPP → DCC / DFR / DTE / DCR / DIA, plus upstream concentrate. Links and templates use absolute GitHub Pages URLs.",
  nodes: Object.keys(FILES).map((name) => ({
    path: credentialUrl(name),
    file: name,
  })),
  sources: [
    "https://untp.unece.org/docs/specification/product-passport",
    "https://untp.unece.org/docs/specification/conformity-credential",
    "https://untp.unece.org/docs/specification/traceability-event",
    "https://untp.unece.org/docs/specification/facility-record",
    "https://untp.unece.org/docs/specification/corporate-record",
    "https://untp.unece.org/docs/specification/identity-anchor",
  ],
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log("Wrote UNTP demo graph to", outDir);
console.log("Public base:", PUBLIC_BASE);
console.log("Entry:", manifest.entry);
