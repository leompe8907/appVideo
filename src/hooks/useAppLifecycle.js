import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import { isAuthenticated } from '../utils/userSession';
import { validateSessionIfDue } from '../utils/sessionValidator';

/** Tiempo máximo en milisegundos en background antes de forzar revalidación silenciosa de token (30 min) */
const MAX_BACKGROUND_MS = 30 * 60 * 1000;
const SESSION_CHECK_KEY = 'app_last_background_time';
const LAST_ROUTE_KEY = 'app_last_active_route';
/** Snapshot de reproducción para recuperarse de un tab discard de Chrome (ver restoreDiscardedPlayback). */
const PLAYBACK_SNAPSHOT_KEY = 'app_player_snapshot_v1';

function savePlaybackSnapshot(player) {
  try {
    const s = player?.state;
    if (!s?.type || !s?.url) {
      sessionStorage.removeItem(PLAYBACK_SNAPSHOT_KEY);
      return;
    }
    sessionStorage.setItem(
      PLAYBACK_SNAPSHOT_KEY,
      JSON.stringify({
        type: s.type,
        id: s.id,
        url: s.url,
        item: s.item,
        mediaOption: s.mediaOption,
        drmConfig: s.drmConfig,
        currentTime: s.currentTime,
        savedAtMs: Date.now(),
      }),
    );
  } catch {
    // noop
  }
}

/**
 * Restaura la reproducción si esta carga de página vino de un tab discard de
 * Chrome (Memory Saver) — `document.wasDiscarded` es la señal oficial para
 * esto (ver https://developer.chrome.com/docs/web-platform/page-lifecycle-api).
 * Sin esto, el usuario vuelve a una pestaña "recargada" que cae al Home, lo
 * que se siente como que se cerró la sesión.
 */
function restoreDiscardedPlayback(player) {
  try {
    if (!document.wasDiscarded) return;
    const raw = sessionStorage.getItem(PLAYBACK_SNAPSHOT_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (!snap?.type || !snap?.url) return;

    player.play({
      type: snap.type,
      id: snap.id,
      url: snap.url,
      item: snap.item,
      mediaOption: snap.mediaOption || {},
      drmConfig: snap.drmConfig || {},
      autoPlay: true,
    });

    // Para VOD/catchup, retomar en la posición donde quedó (un canal en vivo
    // no lo necesita: el propio manifiesto ya entrega el punto en vivo).
    if (snap.type !== 'service' && Number.isFinite(snap.currentTime) && snap.currentTime > 5) {
      const target = snap.currentTime;
      let attempts = 0;
      const trySeek = () => {
        attempts += 1;
        if (player.state?.duration > 0) {
          player.seek(target);
          return;
        }
        if (attempts < 20) setTimeout(trySeek, 250);
      };
      setTimeout(trySeek, 250);
    }
  } catch {
    // noop
  }
}

/**
 * Hook global para gestionar el ciclo de vida de la aplicación (Warm Start / Suspend-Resume).
 * Escucha eventos nativos de visibilidad en navegadores y Smart TVs (Tizen / webOS).
 */
export function useAppLifecycle() {
  const { currentBrand } = useBrand();
  const location = useLocation();
  const wasPlayingRef = useRef(false);

  let player = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    player = usePlayer();
  } catch {
    // Fuera de PlayerProvider
  }

  // Guardar continuamente la ruta activa cuando el usuario navega por la app
  useEffect(() => {
    const path = location.pathname + location.search;
    if (path.startsWith('/home') || path.startsWith('/profile') || path.startsWith('/smartcard')) {
      try {
        localStorage.setItem(LAST_ROUTE_KEY, path);
      } catch {
        // noop
      }
    }
  }, [location]);

  // Restaurar reproducción una sola vez al montar, si esta carga vino de un
  // tab discard de Chrome — independiente del resto del ciclo de vida.
  // Delay corto: PlayerProvider crea el engine de forma asíncrona (import
  // dinámico de video.js/hls.js) en su propio efecto de montaje — sin este
  // margen, `player.play()` puede llamarse antes de que el engine exista.
  useEffect(() => {
    if (!player) return undefined;
    const timer = setTimeout(() => restoreDiscardedPlayback(player), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleHide = () => {
      try {
        const path = location.pathname + location.search;
        sessionStorage.setItem(SESSION_CHECK_KEY, String(Date.now()));
        if (path.startsWith('/home')) {
          localStorage.setItem(LAST_ROUTE_KEY, path);
        }
      } catch {
        // noop
      }

      savePlaybackSnapshot(player);

      const isPlaying = !!player?.state?.isPlaying;
      if (!isPlaying) return;

      // Canal en vivo: NO pausar. Mantener audio/video activos es lo que
      // exime a la pestaña del descarte por Memory Saver de Chrome (ver
      // useMediaSession.js) — pausar acá saca a la pestaña de esa categoría
      // protegida y la deja expuesta al mismo descarte que cualquier otra
      // pestaña inactiva. VOD/catchup sí se pausan (ahorro de datos en
      // contenido on-demand, donde no aplica la misma expectativa de "TV
      // encendida" que un canal en vivo).
      if (player.state?.type === 'service') return;

      wasPlayingRef.current = true;
      try {
        player?.pause?.();
      } catch {
        // noop
      }
    };

    const handleShow = async () => {
      const lastTimeStr = sessionStorage.getItem(SESSION_CHECK_KEY);
      const lastTime = lastTimeStr ? parseInt(lastTimeStr, 10) : 0;
      const elapsed = lastTime ? Date.now() - lastTime : 0;

      if (import.meta.env.DEV) {
        console.log(`📱 [Lifecycle] App reanudada. Tiempo en background: ${Math.round(elapsed / 1000)}s`);
      }

      if (isAuthenticated() && currentBrand) {
        // Revalidar sesión en segundo plano si transcurrió el tiempo límite
        if (elapsed > MAX_BACKGROUND_MS) {
          validateSessionIfDue(currentBrand);
        }

        // Reanudar reproductor si estaba activo antes del suspend.
        // `play()` requiere el objeto { type, id, url, ... } — no tiene
        // default, así que llamarlo sin argumentos tira "Cannot destructure
        // property 'type' of 'undefined'" (quedaba silenciado por el
        // try/catch, dejando el contenido pausado para siempre al volver).
        // Se lee el estado actual y se llama con esos valores — como
        // coincide con el contenido ya cargado, play() toma el atajo
        // interno "mismo contenido -> engine.play()" sin recargar.
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          const s = player?.state;
          if (s?.type && s?.url) {
            try {
              player.play({ type: s.type, id: s.id, url: s.url, item: s.item, mediaOption: s.mediaOption, drmConfig: s.drmConfig });
            } catch {
              // noop
            }
          }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleHide();
      } else if (document.visibilityState === 'visible') {
        handleShow();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('pageshow', handleShow);
    // Page Lifecycle API: último momento confiable antes de que Chrome
    // congele/descarte la pestaña (no soportado en todos los navegadores,
    // por eso `pagehide`/`visibilitychange` arriba quedan como respaldo).
    document.addEventListener('freeze', handleHide);

    // Eventos específicos de Smart TVs (Samsung Tizen)
    let tizenListenerId = null;
    try {
      if (window?.tizen?.application?.getCurrentApplication) {
        const app = window.tizen.application.getCurrentApplication();
        tizenListenerId = app.addEventListener('appstatus', (status) => {
          if (status === 'HIDE' || status === 'SUSPEND') {
            handleHide();
          } else if (status === 'SHOW' || status === 'RESUME') {
            handleShow();
          }
        });
      }
    } catch {
      // noop
    }

    // Eventos específicos de Smart TVs (LG webOS)
    const onWebOSHide = () => handleHide();
    const onWebOSShow = () => handleShow();
    document.addEventListener('webOSHide', onWebOSHide);
    document.addEventListener('webOSShow', onWebOSShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', handleHide);
      window.removeEventListener('pageshow', handleShow);
      document.removeEventListener('freeze', handleHide);
      document.removeEventListener('webOSHide', onWebOSHide);
      document.removeEventListener('webOSShow', onWebOSShow);

      try {
        if (tizenListenerId != null && window?.tizen?.application?.getCurrentApplication) {
          window.tizen.application.getCurrentApplication().removeEventListener(tizenListenerId);
        }
      } catch {
        // noop
      }
    };
  }, [currentBrand, location, player]);
}

export default useAppLifecycle;
