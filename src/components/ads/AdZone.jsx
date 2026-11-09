/**
 * Franja de publicidad: carrusel (auto-rotación, teclado/TV y controles web).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { getDisplayTimeMs, isVideoUrl } from '@appvideo/core/utils/adsData';
import { hasImageFailed, markImageFailed } from '@appvideo/core/utils/remoteImage';
import { getTvActionFromKeyEvent, TV_ACTION } from '../../utils/tvRemote';
import { requestTvFocusRingSync } from '../navigation/tvFocusRingSync';
import { focusFirstIn } from '../../navigation/spatialNavigation';
import { navigationRouter } from '../../navigation/NavigationRouter';

/**
 * Sin placeholder de marca: un anuncio cuyo archivo no carga se saca del carrusel
 * (`onError`); si no queda ninguno, la franja no se dibuja.
 */
function AdMedia({ ad, className = '', onLayoutChange, onError }) {
  if (!ad?.file) return null;
  if (isVideoUrl(ad.file)) {
    const lower = ad.file.toLowerCase();
    let type = 'video/mp4';
    if (lower.endsWith('.webm')) type = 'video/webm';
    else if (lower.endsWith('.ogg')) type = 'video/ogg';
    return (
      <video
        className={`home-ad-media home-ad-media--video ${className}`.trim()}
        autoPlay
        muted
        loop
        playsInline
        tabIndex={-1}
        onLoadedMetadata={onLayoutChange}
      >
        {/* El error de red de un <video> con <source> llega al <source>, no al <video>. */}
        <source src={ad.file} type={type} onError={() => onError?.(ad.file)} />
      </video>
    );
  }
  return (
    <img
      src={ad.file}
      alt={ad.name || ''}
      className={`home-ad-media home-ad-media--img ${className}`.trim()}
      onLoad={onLayoutChange}
      onError={() => onError?.(ad.file)}
    />
  );
}

export function AdZone({ zoneKey, ads, onActivate }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [failedFiles, setFailedFiles] = useState(() => new Set());
  const zoneRef = useRef(null);
  const refocusRootRef = useRef(null);

  const safeAds = (Array.isArray(ads) ? ads : []).filter(
    (ad) => ad?.file && !failedFiles.has(ad.file) && !hasImageFailed(ad.file),
  );
  const count = safeAds.length;
  const currentAd = count > 0 ? safeAds[Math.min(currentIndex, count - 1)] : null;
  const hasMultiple = count > 1;
  const showWebControls = hasMultiple && !isTV;

  useEffect(() => {
    setCurrentIndex(0);
  }, [zoneKey, count]);

  useEffect(() => {
    if (!hasMultiple || !currentAd || interactionPaused) return undefined;
    const ms = getDisplayTimeMs(currentAd);
    const timerId = window.setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % count);
    }, ms);
    return () => window.clearTimeout(timerId);
  }, [count, currentIndex, currentAd, hasMultiple, interactionPaused]);

  const syncFocusRingOnLayoutChange = useCallback(() => {
    requestAnimationFrame(() => requestTvFocusRingSync());
  }, []);

  // markImageFailed: al volver a montar el Inicio, el anuncio roto no se vuelve a pedir.
  const handleMediaError = useCallback((file) => {
    markImageFailed(file);
    const zone = zoneRef.current;
    if (zone && zone.contains(document.activeElement)) {
      refocusRootRef.current = zone.closest('main') || zone.parentElement;
    }
    setFailedFiles((prev) => new Set(prev).add(file));
  }, []);

  // El foco inicial del Inicio cae en la franja (primer enfocable); si desaparece
  // con el foco adentro, el foco queda en <body> hasta la próxima tecla.
  useEffect(() => {
    const root = refocusRootRef.current;
    refocusRootRef.current = null;
    if (count > 0 || !root) return undefined;
    return focusFirstIn(root);
  }, [count]);

  useEffect(() => {
    syncFocusRingOnLayoutChange();
  }, [currentIndex, currentAd?.file, syncFocusRingOnLayoutChange]);

  useEffect(() => {
    if (!currentAd?.dismissTime || currentAd.dismissTime <= 0) return undefined;
    const timerId = window.setTimeout(() => setDismissed(true), currentAd.dismissTime * 1000);
    return () => window.clearTimeout(timerId);
  }, [currentIndex, currentAd]);

  const go = useCallback(
    (delta) => {
      if (!hasMultiple) return;
      setCurrentIndex((i) => (i + delta + count) % count);
    },
    [count, hasMultiple],
  );

  // TV: el NavigationRouter atrapa las flechas en window (captura) antes que el
  // onKeyDown de la franja, así que sin este handler LEFT/RIGHT movían el foco a
  // las tarjetas en vez de cambiar de anuncio. LEFT en el primero no se consume:
  // así se sigue pudiendo salir al menú lateral.
  useEffect(() => {
    if (!isTV || !hasMultiple) return undefined;
    return navigationRouter.register('global', (action) => {
      const zone = zoneRef.current;
      if (!zone || !zone.contains(document.activeElement)) return false;
      if (action === TV_ACTION.RIGHT) {
        go(1);
        return true;
      }
      if (action === TV_ACTION.LEFT && currentIndex > 0) {
        go(-1);
        return true;
      }
      return false;
    });
  }, [isTV, hasMultiple, currentIndex, go]);

  const goTo = useCallback(
    (index) => {
      if (!hasMultiple) return;
      const next = ((index % count) + count) % count;
      setCurrentIndex(next);
    },
    [count, hasMultiple],
  );

  const handleActivate = () => {
    if (currentAd) onActivate?.(currentAd);
  };

  const stopControlEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePrev = (e) => {
    stopControlEvent(e);
    go(-1);
  };

  const handleNext = (e) => {
    stopControlEvent(e);
    go(1);
  };

  const handleDotClick = (e, index) => {
    stopControlEvent(e);
    goTo(index);
  };

  const handleKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tv = getTvActionFromKeyEvent(e);
    if (tv === TV_ACTION.ENTER) {
      e.preventDefault();
      handleActivate();
      return;
    }
    if (tv === TV_ACTION.LEFT) {
      if (hasMultiple) {
        e.preventDefault();
        e.stopPropagation();
        go(-1);
      }
      return;
    }
    if (tv === TV_ACTION.RIGHT) {
      if (hasMultiple) {
        e.preventDefault();
        e.stopPropagation();
        go(1);
      }
    }
  };

  const handleZoneClick = (e) => {
    if (e.target.closest('.home-ad-nav, .home-ad-dot-btn')) return;
    handleActivate();
  };

  const handleFocus = () => {
    setIsFocused(true);
    setInteractionPaused(true);
  };

  const handleBlur = (e) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setIsFocused(false);
    setInteractionPaused(false);
  };

  if (dismissed || count === 0) {
    return null;
  }

  const regionLabel =
    zoneKey === 'top' ? t('homeAds.regionTop') : t('homeAds.regionBottom');

  return (
    <div
      ref={zoneRef}
      className={[
        'home-ad-zone',
        `home-ad-zone--${zoneKey}`,
        isFocused ? 'home-ad-zone--focused' : '',
        showWebControls ? 'home-ad-zone--web-controls' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-ad-zone={zoneKey}
      tabIndex={dismissed ? -1 : 0}
      role="region"
      aria-label={regionLabel}
      aria-roledescription={hasMultiple ? 'carousel' : undefined}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => {
        if (!isFocused) setInteractionPaused(false);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleZoneClick}
      onKeyDown={handleKeyDown}
    >
      {showWebControls && (
        <>
          <button
            type="button"
            className="home-ad-nav home-ad-nav--prev"
            aria-label={t('homeAds.previous')}
            onClick={handlePrev}
          >
            ‹
          </button>
          <button
            type="button"
            className="home-ad-nav home-ad-nav--next"
            aria-label={t('homeAds.next')}
            onClick={handleNext}
          >
            ›
          </button>
        </>
      )}

      <div className="home-ad-slide">
        {currentAd && (
          <AdMedia
            key={currentAd.file}
            ad={currentAd}
            onLayoutChange={syncFocusRingOnLayoutChange}
            onError={handleMediaError}
          />
        )}
      </div>

      {hasMultiple && (
        <div
          className="home-ad-dots"
          role={showWebControls ? 'tablist' : undefined}
          aria-label={showWebControls ? t('homeAds.dotsLabel') : undefined}
        >
          {safeAds.map((ad, i) =>
            showWebControls ? (
              <button
                key={ad?.id ?? i}
                type="button"
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={t('homeAds.goToSlide', { n: i + 1 })}
                className={`home-ad-dot-btn${i === currentIndex ? ' home-ad-dot-btn--active' : ''}`}
                onClick={(e) => handleDotClick(e, i)}
              />
            ) : (
              <span
                key={ad?.id ?? i}
                className={`home-ad-dot${i === currentIndex ? ' home-ad-dot--active' : ''}`}
                aria-hidden="true"
              />
            ),
          )}
        </div>
      )}

      {hasMultiple && (
        <p className="home-ad-counter" aria-live="polite">
          {t('homeAds.slideOf', { current: currentIndex + 1, total: count })}
        </p>
      )}
    </div>
  );
}

export default AdZone;
