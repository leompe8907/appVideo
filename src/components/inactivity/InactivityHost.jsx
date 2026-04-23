import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';
import { useBrand } from '../../contexts/BrandContext';
import { usePreload } from '../../store/usePreload';
import { useInactivityStore } from '../../store/inactivityStore';
import * as userSession from '../../utils/userSession';

function getEffectiveClientConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw.answer ?? raw;
}

function resolveInactivityTimeoutSec(clientConfig, brand) {
  const testOverride = Number(brand?.player?.inactivityTestTimeoutSec);
  if (Number.isFinite(testOverride) && testOverride > 0) return testOverride;

  const cfg = getEffectiveClientConfig(clientConfig);
  const v = cfg?.device?.parameters?.X_INACTIVITY_TIMEOUT_SEC;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;
  return 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function collectScreensaverUrls({ vod, epg, brand }) {
  const urls = [];

  const pickVod = (it) =>
    it?.backgroundImageURL ||
    it?.posterInfoURL ||
    it?.posterListURL ||
    it?.imageUrl ||
    it?.imageUrl2 ||
    it?.posterUrl ||
    it?.coverUrl ||
    it?.thumbnailUrl ||
    null;

  const recommended = vod?.vodRecommended || [];
  const all = vod?.allVods || [];
  for (const it of recommended) {
    const u = pickVod(it);
    if (u) urls.push(String(u));
  }
  for (const it of all.slice(0, 80)) {
    const u = pickVod(it);
    if (u) urls.push(String(u));
  }

  const streams = epg?.streams || [];
  for (const ch of streams.slice(0, 120)) {
    const u = ch?.img || ch?.imageUrl || ch?.logoUrl || ch?.logo || ch?.icon || null;
    if (u) urls.push(String(u));
  }

  // Fallback assets por marca
  const b = String(brand?.brand || '').trim();
  if (b) {
    urls.push(`/${b}/background.png`);
    urls.push(`/${b}/splash.png`);
    urls.push(`/${b}/logo.png`);
  }

  // Shared fallback (si existen en public/shared/)
  urls.push('/shared/screensaver-1.jpg');
  urls.push('/shared/screensaver-2.jpg');
  urls.push('/shared/screensaver-3.jpg');

  return urls.filter(Boolean);
}

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

function formatCountdown(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function InactivityHost() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { vod, epg } = usePreload();
  const player = usePlayer();

  const lastInteractionAtMs = useInactivityStore((s) => s.lastInteractionAtMs);
  const touch = useInactivityStore((s) => s.touch);

  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [screensaverIdx, setScreensaverIdx] = useState(0);

  const timerRef = useRef(null);
  const intervalRef = useRef(null);
  const ssIntervalRef = useRef(null);

  const graceSec = useMemo(() => {
    const v = Number(currentBrand?.player?.inactivityGraceSec);
    return Number.isFinite(v) && v >= 10 ? v : 60;
  }, [currentBrand]);

  const inactivitySec = useMemo(() => {
    const cfg = userSession.getClientConfig();
    return resolveInactivityTimeoutSec(cfg, currentBrand);
  }, [currentBrand]);

  const isPlaybackActive = Boolean(player?.state?.url) && player?.state?.isPlaying === true;

  const screensaverUrls = useMemo(() => {
    const raw = collectScreensaverUrls({ vod, epg, brand: currentBrand });
    // dedupe
    const seen = new Set();
    const unique = [];
    for (const u of raw) {
      const k = String(u);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(k);
    }
    // Shuffle para que parezca random
    return shuffle(unique).slice(0, 12);
  }, [vod, epg, currentBrand]);

  const closeAll = () => {
    setOpen(false);
    setShowScreensaver(false);
    setSecondsLeft(graceSec);
    touch(Date.now());
  };

  // Captura de actividad global (remote/teclas + pointer).
  useEffect(() => {
    const onAny = () => {
      touch(Date.now());
      if (open || showScreensaver) closeAll();
    };
    const onKeyDown = () => onAny();
    const onPointerDown = () => onAny();
    const onMouseMove = () => onAny();

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('mousemove', onMouseMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showScreensaver, graceSec]);

  // Scheduler eficiente: programar el deadline exacto.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ssIntervalRef.current) clearInterval(ssIntervalRef.current);

    setOpen(false);
    setShowScreensaver(false);

    if (!isPlaybackActive) return;
    if (!Number.isFinite(inactivitySec) || inactivitySec <= 0) return;

    const deadline = lastInteractionAtMs + inactivitySec * 1000;
    const ms = Math.max(0, deadline - Date.now());
    timerRef.current = setTimeout(() => {
      setOpen(true);
      setSecondsLeft(graceSec);
    }, ms);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (ssIntervalRef.current) clearInterval(ssIntervalRef.current);
    };
  }, [isPlaybackActive, inactivitySec, lastInteractionAtMs, graceSec]);

  // Countdown del modal
  useEffect(() => {
    if (!open) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [open]);

  // Cuando llega a 0: detener playback + mostrar screensaver
  useEffect(() => {
    if (!open) return;
    if (secondsLeft > 0) return;
    // stopActions (paridad EPG)
    try {
      player?.close?.();
    } catch {
      // noop
    }
    setOpen(false);
    setShowScreensaver(true);
    setScreensaverIdx(0);
  }, [open, secondsLeft, player]);

  // Screensaver: rotación + precarga ligera
  useEffect(() => {
    if (!showScreensaver) return;
    if (ssIntervalRef.current) clearInterval(ssIntervalRef.current);

    // Precargar 2 imágenes iniciales (best-effort)
    const a = screensaverUrls[0];
    const b = screensaverUrls[1];
    if (a) void preloadImage(a);
    if (b) void preloadImage(b);

    ssIntervalRef.current = setInterval(() => {
      setScreensaverIdx((i) => {
        const next = (i + 1) % Math.max(1, screensaverUrls.length);
        const ahead = screensaverUrls[(next + 1) % Math.max(1, screensaverUrls.length)];
        if (ahead) void preloadImage(ahead);
        return next;
      });
    }, clamp(Number(currentBrand?.player?.screensaverRotateMs) || 9000, 4000, 20000));

    return () => {
      if (ssIntervalRef.current) clearInterval(ssIntervalRef.current);
      ssIntervalRef.current = null;
    };
  }, [showScreensaver, screensaverUrls, currentBrand]);

  const title = t('inactivity.title', { defaultValue: '¿Sigues ahí?' });
  const message = t('inactivity.message', {
    defaultValue: 'El contenido se detendrá por inactividad en {{time}}.',
    time: formatCountdown(secondsLeft),
  });

  const bg = screensaverUrls[screensaverIdx] || '';

  return (
    <>
      {open && (
        <div className="inactivity-overlay" role="dialog" aria-modal="true" aria-label={title}>
          <div className="inactivity-card">
            <div className="inactivity-title">{title}</div>
            <div className="inactivity-message">{message}</div>
            <div className="inactivity-actions">
              <button
                type="button"
                className="inactivity-btn inactivity-btn--primary"
                onClick={() => {
                  closeAll();
                }}
              >
                {t('inactivity.continue', { defaultValue: 'Seguir viendo' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScreensaver && (
        <div className="screensaver" role="dialog" aria-modal="true" aria-label={t('inactivity.screensaver', { defaultValue: 'Screensaver' })}>
          <div
            className="screensaver-bg"
            style={bg ? { backgroundImage: `url(${bg})` } : {}}
          />
          <div className="screensaver-dim" />
          <div className="screensaver-brand">
            <div className="screensaver-hint">{t('inactivity.wakeHint', { defaultValue: 'Presiona cualquier tecla para volver' })}</div>
          </div>
        </div>
      )}
    </>
  );
}

export default InactivityHost;

