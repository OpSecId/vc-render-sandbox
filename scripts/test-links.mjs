import assert from "node:assert/strict";
import {
  collectFollowableUrls,
  isFollowableLink,
} from "../src/links.ts";

const vc = {
  id: "https://issuer.example/credentials/1",
  issuer: { id: "did:example:issuer", name: "Issuer" },
  credentialSubject: {
    id: "https://products.example/item/1",
    relatedDocument: [
      {
        linkURL: "https://opsecid.github.io/vc-render-sandbox/credentials/untp/dcc.json",
        linkName: "DCC",
      },
    ],
    claims: [
      {
        evidence: {
          linkURL: "https://opsecid.github.io/vc-render-sandbox/credentials/conformity-credential.json",
        },
      },
    ],
  },
};

const urls = collectFollowableUrls(vc);
assert.equal(urls.size, 2);
assert.ok(!urls.has("https://issuer.example/credentials/1"));
assert.ok(!urls.has("did:example:issuer"));
assert.ok(!urls.has("https://products.example/item/1"));
assert.ok(
  isFollowableLink(
    vc,
    "https://opsecid.github.io/vc-render-sandbox/credentials/untp/dcc.json",
  ),
);
assert.ok(!isFollowableLink(vc, "https://evil.example/track"));
assert.ok(!isFollowableLink(vc, "javascript:alert(1)"));
assert.ok(!isFollowableLink(vc, "data:text/html,hi"));

console.log("test-links ok");
