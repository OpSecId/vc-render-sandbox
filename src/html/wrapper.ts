import type { VerifiableCredential } from "../types";

/**
 * Wrapper code that wraps the HTML template fragment + credential data block.
 * CSP: default-src data: 'unsafe-inline' — no network from template code.
 *
 * Bridge APIs for template scripts:
 * - window.renderMethodReady(err?) — signal host that rendering finished
 * - window.renderMethodFollow({ href, linkType?, label? }) — host-mediated link
 *
 * Messaging uses parent.postMessage with a per-mount handshake id. MessageChannel
 * port transfer into opaque-origin sandboxed srcdoc iframes is unreliable across
 * browsers; the security properties (no network, no top-nav, no host DOM) still
 * come from iframe sandbox + wrapper CSP.
 *
 * @see https://www.w3.org/TR/vc-render-method/#wrapper-code
 */

export function buildWrapperSrcdoc(
  filteredCredential: VerifiableCredential,
  templateHtml: string,
  handshakeId: string,
): string {
  const credentialJson = JSON.stringify(filteredCredential).replace(
    /<\/script/gi,
    "<\\/script",
  );

  const bridgeScript = `
<script>
(function () {
  var handshakeId = ${JSON.stringify(handshakeId)};

  function send(payload) {
    payload.type = 'vcrender';
    payload.handshakeId = handshakeId;
    try {
      window.parent.postMessage(payload, '*');
    } catch (e) {}
  }

  window.renderMethodReady = function (err) {
    if (!err) {
      send({ event: 'ready' });
    } else {
      send({
        event: 'error',
        error: { message: err && err.message ? err.message : String(err) }
      });
    }
  };

  window.renderMethodFollow = function (request) {
    if (!request || typeof request.href !== 'string') {
      throw new Error('renderMethodFollow requires { href: string }');
    }
    send({
      event: 'followLink',
      href: request.href,
      linkType: request.linkType,
      label: request.label
    });
  };
})();
</script>
`.trim();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src data: 'unsafe-inline'">
    <script name="credential" type="application/vc">${credentialJson}</script>
    ${bridgeScript}
  </head>
  <body>
${templateHtml}
  </body>
</html>`;
}
