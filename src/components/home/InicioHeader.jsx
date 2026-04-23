import { useTranslation } from 'react-i18next';
import { useBrand } from '../../contexts/BrandContext';
import { useDeviceTime } from '../../hooks/useDeviceTime';
import { useHomeHeader } from '../../contexts/homeHeaderContext';
import { getCurrentEpgEvent } from '../../utils/epgCurrentEvent';
import { parseEpgDateToMs, formatHHmmFromMs } from '../../utils/epgTime';

/**
 * Cabecera de Inicio: tres zonas horizontales (izquierda, centro, derecha).
 * La configuración por marca vive en `currentBrand.header` (brands.js).
 */
function fmtHHmm(dateLike) {
  const ms = parseEpgDateToMs(dateLike);
  return ms == null ? '' : formatHHmmFromMs(ms);
}

function getEventTitle(event) {
  return event?.languages?.[0]?.title || event?.title || event?.name || '';
}

function getEventDescription(event) {
  return event?.languages?.[0]?.description || event?.description || event?.summary || '';
}

function resolveJustify(align) {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
}

function resolveInlineAlignStyle(align) {
  if (align === 'center') return { marginLeft: 'auto', marginRight: 'auto' };
  if (align === 'right') return { marginLeft: 'auto' };
  return {};
}

function getNextEpgEvent(epgItems, currentEvent) {
  if (!Array.isArray(epgItems) || epgItems.length === 0) return null;
  const currEndMs = currentEvent?.endDate?.valueOf?.() ?? new Date(currentEvent?.end).getTime();
  if (!Number.isFinite(currEndMs)) return null;
  let best = null;
  let bestStart = Infinity;
  for (const ev of epgItems) {
    const startMs = ev?.startDate?.valueOf?.() ?? new Date(ev?.start).getTime();
    if (!Number.isFinite(startMs)) continue;
    if (startMs >= currEndMs && startMs < bestStart) {
      best = ev;
      bestStart = startMs;
    }
  }
  return best;
}

export function InicioHeader({ sectionKey = null }) {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { focusedChannel } = useHomeHeader();

  const areas = currentBrand?.header?.areas || {};
  const left = areas.left || {};
  const center = areas.center || {};
  const right = areas.right || {};

  const subAreas = currentBrand?.header?.subheader?.areas || {};
  const subLeft = subAreas.left || {};
  const subCenter = subAreas.center || {};
  const subRight = subAreas.right || {};

  const logoSrc = currentBrand?.assets?.logo || null;
  const appName = currentBrand?.appName || 'App';

  const shouldUpdateTime = Boolean(left.showTime || center.showTime || right.showTime);
  const { text: deviceTimeText } = useDeviceTime(
    shouldUpdateTime
      ? { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
      : { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
  );

  const { now: serviceNow } = useDeviceTime(
    (subLeft.showServiceInfo || subCenter.showServiceInfo || subRight.showServiceInfo)
      ? { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
      : { locale: currentBrand?.ui?.locale, format: 'HH:mm' }
  );

  const renderArea = (cfg, areaKey) => {
    const enabled = cfg.enabled !== false;
    if (!enabled) {
      return <div className={`inicio-header__col inicio-header__col--${areaKey}`} data-enabled="0" />;
    }

    return (
      <div
        className={`inicio-header__col inicio-header__col--${areaKey}`}
        data-enabled="1"
        style={{ justifyContent: resolveJustify(cfg.contentAlign) }}
      >
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

  const renderServiceInfo = () => {
    const epgItems = focusedChannel?.epgItems || [];
    const current = getCurrentEpgEvent(epgItems);
    const next = getNextEpgEvent(epgItems, current);

    const channelLcn = focusedChannel?.lcn ?? focusedChannel?.LCN ?? '';
    const channelName = focusedChannel?.name ?? focusedChannel?.Name ?? '';

    const currentTitle = getEventTitle(current);
    const currentDesc = getEventDescription(current);
    const currentStart = current?.startDate?.valueOf?.() ?? current?.start;
    const currentEnd = current?.endDate?.valueOf?.() ?? current?.end;
    const currentTime = current ? `${fmtHHmm(currentStart)} – ${fmtHHmm(currentEnd)}`.trim() : '';

    const nextTitle = getEventTitle(next);
    const nextDesc = getEventDescription(next);
    const nextStart = next?.startDate?.valueOf?.() ?? next?.start;
    const nextEnd = next?.endDate?.valueOf?.() ?? next?.end;
    const nextTime = next ? `${fmtHHmm(nextStart)} – ${fmtHHmm(nextEnd)}`.trim() : '';

    // Fuerza re-render cuando cambia el tiempo (minuto) aunque el foco no cambie.
    const _ = serviceNow?.valueOf?.();

    if (!current && !next) {
      return (
        <div className="inicio-service-info inicio-service-info--empty">
          {t('inicio.serviceInfo.empty', { defaultValue: 'Selecciona un canal para ver información.' })}
        </div>
      );
    }

    return (
      <div className="inicio-service-info">
        {(channelLcn || channelName) ? (
          <div className="inicio-service-info__channel" title={`${channelLcn ? `${channelLcn} ` : ''}${channelName}`.trim()}>
            {channelLcn ? <span className="inicio-service-info__channel-lcn">{channelLcn}</span> : null}
            {channelName ? <span className="inicio-service-info__channel-name">{channelName}</span> : null}
          </div>
        ) : null}
        {current ? (
          <div className="inicio-service-info__block">
            <div className="inicio-service-info__label">
              {t('inicio.serviceInfo.current', { defaultValue: 'Ahora' })}
              {currentTime ? <span className="inicio-service-info__time">{currentTime}</span> : null}
            </div>
            <div className="inicio-service-info__title" title={currentTitle}>{currentTitle || '—'}</div>
            {currentDesc ? <div className="inicio-service-info__desc" title={currentDesc}>{currentDesc}</div> : null}
          </div>
        ) : null}
        {next ? (
          <div className="inicio-service-info__block">
            <div className="inicio-service-info__label">
              {t('inicio.serviceInfo.next', { defaultValue: 'Siguiente' })}
              {nextTime ? <span className="inicio-service-info__time">{nextTime}</span> : null}
            </div>
            <div className="inicio-service-info__title" title={nextTitle}>{nextTitle || '—'}</div>
            {nextDesc ? <div className="inicio-service-info__desc" title={nextDesc}>{nextDesc}</div> : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSubArea = (cfg, areaKey) => {
    const enabled = cfg.enabled !== false;
    if (!enabled) {
      return <div className={`inicio-subheader__col inicio-subheader__col--${areaKey}`} data-enabled="0" />;
    }
    return (
      <div
        className={`inicio-subheader__col inicio-subheader__col--${areaKey}`}
        data-enabled="1"
        style={{ justifyContent: resolveJustify(cfg.contentAlign) }}
      >
        <div className="inicio-subheader__content" style={resolveInlineAlignStyle(cfg.contentAlign)}>
          {cfg.showServiceInfo ? renderServiceInfo() : null}
        </div>
      </div>
    );
  };

  return (
    <div className="inicio-header-wrap" aria-label={t('inicio.header', { defaultValue: 'Cabecera de inicio' })}>
      <header className="inicio-header">
        {renderArea(left, 'left')}
        {renderArea(center, 'center')}
        {renderArea(right, 'right')}
      </header>
      {sectionKey === 'inicio' && (
        <div className="inicio-subheader" aria-label={t('inicio.subheader', { defaultValue: 'Subcabecera' })}>
          {renderSubArea(subLeft, 'left')}
          {renderSubArea(subCenter, 'center')}
          {renderSubArea(subRight, 'right')}
        </div>
      )}
    </div>
  );
}

export default InicioHeader;
