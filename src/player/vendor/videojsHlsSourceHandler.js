/**
 * Source handler HLS para el Tech `Html5` de video.js, usando directamente
 * `hls.js` (vía `HlsPlaybackController`, ya escrita y con el mismo `hls.js`
 * declarado en package.json) en vez del plugin vendorizado de Streamroot
 * (`videojs-hlsjs-plugin.js`, build de 2018 con su propia copia interna de
 * hls.js, sin ninguna forma documentada de sustituirla por una externa —
 * se verificó tanto el bundle vendorizado como la última versión publicada
 * en npm, y ambos son el mismo build autocontenido).
 *
 * Con esto queda un único hls.js en toda la app (el de `package.json`), tanto
 * para este motor (video.js, PC/TV sin engine nativo) como para el resto.
 *
 * Contrato de `Tech.registerSourceHandler` — estable en video.js 5/6/7/8, y
 * verificado además inspeccionando el bundle del plugin anterior (usaba
 * exactamente este mismo patrón contra esta misma versión de video.js):
 *   - `canHandleSource(source)` → 'probably' | 'maybe' | ''
 *   - `handleSource(source, tech)` → objeto con `dispose()`
 *   - errores fatales: sobreescribir `tech.error` para que devuelva el
 *     objeto de error y disparar `tech.trigger('error')` (mismo mecanismo
 *     que usaba el plugin anterior, no una API más nueva de video.js).
 *
 * Nota de alcance: esto no fue posible verificarlo con reproducción real en
 * hardware TV/navegador desde este entorno — antes de desplegar, probar
 * reproducción HLS (en vivo, VOD, Wind/AES) en al menos un navegador real y,
 * si es posible, en el hardware TV objetivo.
 */

import { HlsPlaybackController } from '../engines/web/HlsPlaybackController.js';

function canHandleSource(source) {
  if (!source) return '';
  const type = source.type || '';
  const src = source.src || '';
  if (/^application\/x-mpegURL$|^application\/vnd\.apple\.mpegurl$/i.test(type)) return 'probably';
  if (/\.m3u8/i.test(src)) return 'maybe';
  return '';
}

function handleSource(source, tech) {
  const videoEl = tech.el();
  let disposed = false;

  const surfaceFatalError = (err) => {
    if (disposed) return;
    const message = err?.message || 'Error HLS';
    // Mismo mecanismo que usaba el plugin anterior: reemplazar `tech.error`
    // (normalmente un getter sobre `tech.el().error`) por uno que devuelva
    // este objeto, y disparar 'error' en el tech para que video.js lo relaye
    // al player (`player.error()`/evento 'error' que ya escucha WebEngine).
    tech.error = () => ({ code: 2, message });
    try {
      tech.trigger('error');
    } catch {
      /* noop */
    }
  };

  const controller = new HlsPlaybackController({
    onError: surfaceFatalError,
  });

  controller.load(videoEl, source.src, { autoPlay: false }).catch(surfaceFatalError);

  const provider = {
    // Compatibilidad con WebEngine._disposeHlsProvider(), que ya esperaba
    // `tech.hlsProvider.dispose()` (mismo contrato que exponía el plugin
    // anterior) y con utilidades existentes (`attachWindLevelLock`) que leen
    // `tech.hlsProvider.hls`.
    get hls() {
      return controller.instance;
    },
    dispose() {
      disposed = true;
      controller.destroy();
    },
  };
  tech.hlsProvider = provider;

  return provider;
}

/**
 * Registra el source handler en el Tech Html5 de la instancia de video.js dada.
 * Idempotente a nivel de módulo (no vuelve a registrar si ya se llamó antes).
 * @param {typeof import('video.js').default} vjs
 * @returns {boolean} true si se registró (o ya estaba registrado)
 */
let registered = false;
export function registerVideojsHlsSourceHandler(vjs) {
  if (registered) return true;
  if (!vjs || typeof vjs.getTech !== 'function') return false;
  const Html5 = vjs.getTech('Html5');
  if (!Html5 || typeof Html5.registerSourceHandler !== 'function') return false;

  // Prioridad 0: mismo lugar donde se registraba el plugin anterior (antes
  // que el handler nativo de video.js, que no sirve para HLS vía MSE).
  Html5.registerSourceHandler(
    {
      canHandleSource,
      canPlayType: () => '',
      handleSource,
    },
    0,
  );
  registered = true;
  return true;
}

export default registerVideojsHlsSourceHandler;
