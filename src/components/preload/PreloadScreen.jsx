/**
 * Pantalla de precarga (EPG, etc.) con diseño similar al loading del proyecto EPG.
 * Muestra logo, fondo, spinner, barra de progreso, mensaje y tips rotativos.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { usePreload } from '../../store/usePreload';

const TIPS_INTERVAL_MS = 4000;

export function PreloadScreen() {
  const { t } = useTranslation();
  const { currentBrand, getImage } = useBrand();
  const { epg } = usePreload();
  const [tipIndex, setTipIndex] = useState(0);

  const tips = [
    t('preload.tip1'),
    t('preload.tip2'),
    t('preload.tip3'),
    t('preload.tip4'),
  ].filter(Boolean);

  useEffect(() => {
    if (tips.length <= 1) return;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, TIPS_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tips.length]);

  const logoPath = currentBrand?.assets?.logo || getImage('logo.png');
  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');
  const progress = epg?.progress || { percent: 0, current: 0, total: 0 };
  const percent = progress.percent ?? 0;
  const current = progress.current ?? 0;
  const total = progress.total ?? 0;

  const message = epg.status === 'loading'
    ? t('preload.message')
    : epg.status === 'error'
      ? t('preload.error')
      : t('preload.message');
  const submessage =
    epg.status === 'loading' && total > 0
      ? t('preload.channelsProgress', { current, total })
      : epg.status === 'ready' || epg.status === 'finishing'
        ? t('preload.finishing')
        : '';

  return (
    <div id="scene-preload" className="scene-preload">
      <div className="preload-container">
        {backgroundPath && (
          <div
            className="preload-background"
            style={{ backgroundImage: `url(${backgroundPath})` }}
          />
        )}
        <div className="preload-content">
          <div className="preload-logo-container">
            <img
              src={logoPath}
              alt=""
              className="preload-logo"
            />
          </div>

          <div className="preload-spinner-container">
            <div className="preload-spinner preload-spinner-active">
              <div className="spinner-inner" />
            </div>
          </div>

          <div className="preload-progress-container">
            <div className="preload-progress-bar">
              <div
                id="loadingProgressFill"
                className="preload-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="preload-progress-text" id="loadingProgressText">
              {Math.round(percent)}%
            </div>
          </div>

          <div className="preload-text">
            <p className="preload-message" id="loadingMessage">
              {message}
            </p>
            <p className="preload-submessage" id="loadingSubmessage">
              {submessage}
            </p>
          </div>

          {tips.length > 0 && (
            <div className="preload-tips-container">
              <div className="preload-tip" id="loadingTip">
                {tips[tipIndex]}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PreloadScreen;
