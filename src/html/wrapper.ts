import { applyNonceToScripts } from "../csp-nonce";
import type { VerifiableCredential } from "../types";

/**
 * Wrapper code that wraps the HTML template fragment + credential data block.
 *
 * CSP (on the srcdoc document): default-src data:; script-src 'nonce-…'
 * — network blocked; only nonced scripts run (bridge + template).
 *
 * Bridge APIs:
 * - window.renderMethodReady(err?) — HTML suite
 * - window.renderMethodFollow({ href, linkType?, label? }) — extension
 *
 * @see https://www.w3.org/TR/vc-render-method/#wrapper-code
 */

export function buildWrapperSrcdoc(
  filteredCredential: VerifiableCredential,
  templateHtml: string,
  nonce: string,
): string {
  const credentialJson = JSON.stringify(filteredCredential).replace(
    /<\/script/gi,
    "<\\/script",
  );

  const safeTemplate = applyNonceToScripts(templateHtml, nonce);
  const n = escapeAttr(nonce);

  const bridgeScript = `
<script nonce="${n}">
(function () {
  var portPromise = new Promise(function (resolve) {
    window.addEventListener('message', function start(event) {
      if (event.source !== window.parent) return;
      if (event.data === 'start' && event.ports && event.ports[0]) {
        window.removeEventListener('message', start);
        var port = event.ports[0];
        port.start();
        resolve(port);
      }
    });
  });

  window.renderMethodReady = function (err) {
    portPromise.then(function (port) {
      if (!err) {
        port.postMessage('ready');
      } else {
        port.postMessage({
          error: { message: err && err.message ? err.message : String(err) }
        });
      }
    });
  };

  window.renderMethodFollow = function (request) {
    if (!request || typeof request.href !== 'string') {
      throw new Error('renderMethodFollow requires { href: string }');
    }
    portPromise.then(function (port) {
      port.postMessage({
        type: 'followLink',
        href: request.href,
        linkType: request.linkType,
        label: request.label
      });
    });
  };
})();
</script>
`.trim();

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src data:; script-src 'nonce-${n}'; style-src 'unsafe-inline' data:;">
    <script name="credential" type="application/vc" nonce="${n}">${credentialJson}</script>
    ${bridgeScript}
  </head>
  <body>
${safeTemplate}
  </body>
</html>`;
}

function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
