import type { VerifiableCredential } from "../types";

/**
 * Wrapper code that wraps the HTML template fragment + credential data block.
 * CSP: default-src data: 'unsafe-inline' — no network from template code.
 *
 * Bridge APIs for template scripts:
 * - window.renderMethodReady(err?) — signal host that rendering finished
 * - window.renderMethodFollow({ href, linkType?, label? }) — host-mediated link
 *   (sandbox extension; rides the same MessageChannel)
 *
 * Communication uses MessageChannel as required by the HTML suite algorithm.
 *
 * @see https://www.w3.org/TR/vc-render-method/#wrapper-code
 */

export function buildWrapperSrcdoc(
  filteredCredential: VerifiableCredential,
  templateHtml: string,
): string {
  const credentialJson = JSON.stringify(filteredCredential).replace(
    /<\/script/gi,
    "<\\/script",
  );

  const bridgeScript = `
<script>
(function () {
  var portPromise = new Promise(function (resolve) {
    window.addEventListener('message', function start(event) {
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
    <meta http-equiv="Content-Security-Policy" content="default-src data: 'unsafe-inline'">
    <script name="credential" type="application/vc">${credentialJson}</script>
    ${bridgeScript}
  </head>
  <body>
${templateHtml}
  </body>
</html>`;
}
