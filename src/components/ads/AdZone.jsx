/**
 * Franja de publicidad: carrusel (auto-rotación, teclado/TV y controles web).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { getDisplayTimeMs, isVideoUrl } from '../../utils/adsData';
import { getTvActionFromKeyEvent, TV_ACTION } from '../../utils/tvRemote';
import { requestTvFocusRingSync } from '../navigation/TvFocusRing';
import { BrandFallbackImage } from '../common/BrandFallbackImage';

function AdMedia({ ad, className = '', onLayoutChange }) {
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
        <source src={ad.file} type={type} />
      </video>
    );
  }
  return (
    <BrandFallbackImage
      src={ad.file}
      alt={ad.name || ''}
      className={`home-ad-media home-ad-media--img ${className}`.trim()}
      onLoad={onLayoutChange}
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

  const safeAds = Array.isArray(ads) ? ads : [];
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

  const syncFocusRingIfFocused = useCallback(() => {
    if (!isFocused) return;
    requestAnimationFrame(() => requestTvFocusRingSync());
  }, [isFocused]);

  useEffect(() => {
    syncFocusRingIfFocused();
  }, [currentIndex, currentAd?.file, syncFocusRingIfFocused]);

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
        {currentAd && <AdMedia ad={currentAd} onLayoutChange={syncFocusRingIfFocused} />}
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
