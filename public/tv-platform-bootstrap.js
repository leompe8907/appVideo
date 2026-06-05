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

  function loadNext(index, callback) {
    if (index >= scripts.length) {
      callback();
      return;
    }
    var src = scripts[index];
    var el = global.document.createElement('script');
    el.src = src;
    el.onload = function () {
      loadNext(index + 1, callback);
    };
    el.onerror = function () {
      try {
        console.warn('[tv-platform-bootstrap] No se pudo cargar:', src);
      } catch (e) { /* noop */ }
      loadNext(index + 1, callback);
    };
    global.document.head.appendChild(el);
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
