/**
 * Carga condicional de SDKs nativos TV antes del bundle React.
 * - Tizen: $WEBAPIS/webapis/webapis.js (ruta del sistema en Samsung TV)
 * - webOS: webOSTV.js (incluido en el paquete IPK de la app)
 *
 * En navegador de escritorio no inyecta nada (evita 404).
 */
(function tvPlatformBootstrap(global) {
  if (global.__tvPlatformBootstrapDone) return;
  global.__tvPlatformBootstrapDone = true;

  var ua = String(global.navigator && global.navigator.userAgent || '').toLowerCase();
  var forced = String(global.__VITE_TV_PLATFORM__ || '').toLowerCase();

  var isTizen =
    forced === 'tizen' ||
    forced === 'samsung' ||
    ua.indexOf('tizen') !== -1 ||
    (typeof global.tizen !== 'undefined');

  var isWebOS =
    forced === 'webos' ||
    forced === 'lg' ||
    ua.indexOf('webos') !== -1 ||
    ua.indexOf('web0s') !== -1 || // el UA real de LG dice "Web0S" (con cero)
    ua.indexOf('netcast') !== -1 ||
    (typeof global.webOS !== 'undefined') ||
    (typeof global.PalmSystem !== 'undefined');

  var scripts = [];

  if (isTizen && typeof global.webapis === 'undefined') {
    scripts.push('$WEBAPIS/webapis/webapis.js');
  }

  if (isWebOS && typeof global.webOS === 'undefined') {
    scripts.push('webOSTV.js');
  }

  // Un servidor con fallback de SPA responde 200 con el index.html a un .js que no existe
  // (ej. webOSTV.js sin copiar al paquete): al cargarlo como script da "Unexpected token <".
  // Se comprueba antes que lo que llega no sea HTML. En file:// y con rutas del sistema
  // ($WEBAPIS) no hay nada que comprobar.
  // ES5 a propósito: este archivo no pasa por Babel.
  function looksLikeScript(src, done) {
    var local = src.charAt(0) === '$' || (global.location && global.location.protocol === 'file:');
    if (local || typeof global.XMLHttpRequest === 'undefined') {
      done(true);
      return;
    }
    try {
      var xhr = new global.XMLHttpRequest();
      xhr.open('HEAD', src, true);
      xhr.onload = function () {
        var type = String(xhr.getResponseHeader('Content-Type') || '').toLowerCase();
        done(xhr.status >= 200 && xhr.status < 300 && type.indexOf('text/html') === -1);
      };
      xhr.onerror = function () {
        done(false);
      };
      xhr.send();
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      done(true);
    }
  }

  function loadNext(index, callback) {
    if (index >= scripts.length) {
      callback();
      return;
    }
    var src = scripts[index];
    looksLikeScript(src, function (ok) {
      if (!ok) {
        try {
          console.warn('[tv-platform-bootstrap] No existe o no es un script:', src);
          // eslint-disable-next-line no-unused-vars
        } catch (e) { /* noop */ }
        loadNext(index + 1, callback);
        return;
      }
      var el = global.document.createElement('script');
      el.src = src;
      el.onload = function () {
        loadNext(index + 1, callback);
      };
      el.onerror = function () {
        try {
          console.warn('[tv-platform-bootstrap] No se pudo cargar:', src);
          // eslint-disable-next-line no-unused-vars
        } catch (e) { /* noop */ }
        loadNext(index + 1, callback);
      };
      global.document.head.appendChild(el);
    });
  }

  global.__tvPlatformReady = new Promise(function (resolve) {
    if (scripts.length === 0) {
      resolve({ loaded: [], platform: isTizen ? 'tizen' : isWebOS ? 'webos' : 'web' });
      return;
    }
    loadNext(0, function () {
      resolve({
        loaded: scripts.slice(),
        platform: isTizen ? 'tizen' : isWebOS ? 'webos' : 'web',
        hasWebapis: typeof global.webapis !== 'undefined',
        hasWebOS: typeof global.webOS !== 'undefined',
      });
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
