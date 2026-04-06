import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { useDeviceTime } from '../../hooks/useDeviceTime';

/**
 * Cabecera de Inicio: tres zonas horizontales (izquierda, centro, derecha).
 * La configuración por marca vive en `currentBrand.header` (brands.js).
 */
export function InicioHeader() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();

  const areas = currentBrand?.header?.areas || {};
  const left = areas.left || {};
  const center = areas.center || {};
  const right = areas.right || {};

  const logoSrc = currentBrand?.assets?.logo || null;
  const appName = currentBrand?.appName || 'App';

  const shouldUpdateTime = Boolean(left.showTime || center.showTime || right.showTime);
  const { text: deviceTimeText } = useDeviceTime(
    shouldUpdateTime
      ? { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
      : { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
  );

  const renderArea = (cfg, areaKey) => {
    const enabled = cfg.enabled !== false;
    if (!enabled) {
      return <div className={`inicio-header__col inicio-header__col--${areaKey}`} data-enabled="0" />;
    }

    return (
      <div className={`inicio-header__col inicio-header__col--${areaKey}`} data-enabled="1">
        {cfg.showLogo && logoSrc ? (
          <img className="inicio-header__logo" src={logoSrc} alt={appName} />
        ) : null}
        {cfg.showTime ? (
          <div className="inicio-header__time" aria-label={t('common.time', { defaultValue: 'Hora' })}>
            {deviceTimeText}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <header className="inicio-header" aria-label={t('inicio.header', { defaultValue: 'Cabecera de inicio' })}>
      {renderArea(left, 'left')}
      {renderArea(center, 'center')}
      {renderArea(right, 'right')}
    </header>
  );
}

export default InicioHeader;
