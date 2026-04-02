/**
 * Franja de publicidad: un creativo o carrusel (un solo slide visible; índice compartido para auto-rotación y flechas).
 */

import { useEffect, useState, useCallback } from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import { getDisplayTimeMs, isVideoUrl } from '../../utils/adsData';

function AdMedia({ ad, className = '' }) {
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
      >
        <source src={ad.file} type={type} />
      </video>
    );
  }
  return (
    <img
      className={`home-ad-media home-ad-media--img ${className}`.trim()}
      src={ad.file}
      alt={ad.name || ''}
    />
  );
}

export function AdZone({ zoneKey, ads, onActivate }) {
  const { isTV } = useDevice();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const safeAds = Array.isArray(ads) ? ads : [];
  const count = safeAds.length;
  const currentAd = count > 0 ? safeAds[Math.min(currentIndex, count - 1)] : null;

  useEffect(() => {
    if (count <= 1 || !currentAd) return;
    const ms = getDisplayTimeMs(currentAd);
    const t = setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % count);
    }, ms);
    return () => clearTimeout(t);
  }, [count, currentIndex, currentAd]);

  useEffect(() => {
    if (!currentAd?.dismissTime || currentAd.dismissTime <= 0) return;
    const t = setTimeout(() => setDismissed(true), currentAd.dismissTime * 1000);
    return () => clearTimeout(t);
  }, [currentIndex, currentAd]);

  const go = useCallback(
    (delta) => {
      if (count <= 1) return;
      setCurrentIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  const handleActivate = () => {
    if (currentAd) onActivate?.(currentAd);
  };

  const { ref, focused } = useSpatialNavigation({
    focusKey: `ad-zone-${zoneKey}`,
    onEnterPress: handleActivate,
    isFocusable: !dismissed && count > 0,
    onArrowPress: (direction) => {
      // Intercept left/right arrows to slide the carousel
      if (direction === 'left') {
        go(-1);
        return false;
      }
      if (direction === 'right') {
        go(1);
        return false;
      }
      return true;
    }
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    } else if (e.key === 'ArrowLeft') {
      go(-1);
    } else if (e.key === 'ArrowRight') {
      go(1);
    }
  };

  if (dismissed || count === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`home-ad-zone home-ad-zone--${zoneKey} ${focused ? 'focused' : ''}`}
      data-ad-zone={zoneKey}
      tabIndex={isTV ? -1 : (dismissed ? -1 : 0)}
      role="region"
      aria-label={zoneKey === 'top' ? 'Publicidad superior' : 'Publicidad inferior'}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div className="home-ad-slide">{currentAd && <AdMedia ad={currentAd} />}</div>
      {count > 1 && (
        <div className="home-ad-dots" aria-hidden="true">
          {safeAds.map((_, i) => (
            <span key={i} className={`home-ad-dot${i === currentIndex ? ' home-ad-dot--active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default AdZone;
