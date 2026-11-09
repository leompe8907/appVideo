/**
 * Driver de teclas dentro de la página, para medir SIN modo debug (en Tizen
 * el modo debug, necesario para CDP, agrega costo). Lo inyecta
 * `inject-probe.mjs --page-driver` solo en la copia de medición; pide teclas
 * al recolector con long-poll (`GET /cmd`) y las despacha como keydown/keyup
 * sobre el elemento con foco. No pasa por el sistema del TV (registerKey):
 * eso se valida con el control físico.
 *
 * Se arma como IIFE con `__ENDPOINT__` y `__LABEL__` reemplazados.
 */
(function () {
  var base = '__ENDPOINT__'.replace(/\/probe$/, '');
  var label = '__LABEL__';

  function dispatch(type, k) {
    var ev = new KeyboardEvent(type, { key: k.key, bubbles: true, cancelable: true });
    // keyCode/which no se pueden fijar por el constructor en Chromium 68/69.
    Object.defineProperty(ev, 'keyCode', { get: function () { return k.code; } });
    Object.defineProperty(ev, 'which', { get: function () { return k.code; } });
    var target = document.activeElement || document.body;
    target.dispatchEvent(ev);
    // Un Enter sintético no activa links ni botones (el navegador solo hace la
    // acción por defecto con teclas reales): se emula si la app no la canceló.
    if (type === 'keydown' && k.code === 13 && !ev.defaultPrevented &&
        /^(A|BUTTON)$/.test(target.tagName) && typeof target.click === 'function') {
      target.click();
    }
  }

  function poll() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + '/cmd?label=' + encodeURIComponent(label), true);
    xhr.timeout = 30000;
    xhr.onload = function () {
      try {
        var keys = JSON.parse(xhr.responseText || '[]');
        keys.forEach(function (k) {
          dispatch('keydown', k);
          dispatch('keyup', k);
        });
      } catch { /* respuesta inválida: se ignora */ }
      poll();
    };
    xhr.onerror = xhr.ontimeout = function () { window.setTimeout(poll, 2000); };
    xhr.send();
  }
  poll();
})();
