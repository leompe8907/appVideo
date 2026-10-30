import * as React from 'react';
import {Image, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig, resolveHeaderActivado, resolveHomeShellHeaderEnabled, resolveShellMode, resolveSubheaderActivado} from '@appvideo/core/config/brandConfig';
import {Clock} from '../components/Clock';
import {getNowNext} from '../epg';
import {useFocusedChannel} from './focusedChannel';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

// Sección del home → clave de `brand.homeShell.header` (como HomeShellContent de la web).
const SECTION_KEYS = {inicio: 'inicio', channels: 'serviciosTvRadio', vod: 'vod', catchup: 'catchup'};

/** ¿Se muestra la cabecera en esta sección? (`homeShell.header.<sección>` y `header.activado.tv`). */
export function isInicioHeaderEnabled(section, brand = getActiveBrandConfig()) {
  const key = SECTION_KEYS[section];
  return Boolean(key) && resolveHomeShellHeaderEnabled(brand, key) && resolveHeaderActivado(brand, true);
}

const JUSTIFY = {left: 'flex-start', center: 'center', right: 'flex-end'};

/**
 * Cabecera de las secciones del home (InicioHeader de la web): fila con tres
 * zonas (`brand.header.areas.left|center|right`) que pueden mostrar el logo
 * (`showLogo`) y la hora (`showTime`). En Inicio, la subcabecera
 * (`header.subheader`, zonas con `showServiceInfo`) muestra el canal con foco y
 * su programa actual y siguiente.
 */
export function InicioHeader({section}) {
  const brand = getActiveBrandConfig();
  const theme = getTheme();
  const areas = brand?.header?.areas || {};
  const topbar = resolveShellMode(brand, true) === 'topbar';
  const hasContent = ['left', 'center', 'right'].some((k) => {
    const a = areas[k] || {};
    return a.enabled !== false && ((a.showLogo && !topbar) || a.showTime);
  });
  const sub = brand?.header?.subheader || {};
  const subAreas = sub.areas || {};
  const showSubheader =
    section === 'inicio' &&
    (sub.enabled ?? true) &&
    resolveSubheaderActivado(brand, true) &&
    ['left', 'center', 'right'].some((k) => subAreas[k]?.enabled !== false && subAreas[k]?.showServiceInfo);
  if (!hasContent && !showSubheader) return null;

  const renderArea = (key) => {
    const a = areas[key] || {};
    if (a.enabled === false) return <View key={key} style={styles.col} />;
    return (
      <View key={key} style={[styles.col, {justifyContent: JUSTIFY[a.contentAlign] || 'flex-start'}]}>
        {a.showLogo && !topbar ? <Image source={theme.logo} style={styles.logo} resizeMode="contain" /> : null}
        {a.showTime ? <Clock style={styles.time} /> : null}
      </View>
    );
  };

  const renderSubArea = (key) => {
    const a = subAreas[key] || {};
    const on = a.enabled !== false && a.showServiceInfo;
    return (
      <View key={key} style={[styles.col, {justifyContent: JUSTIFY[a.contentAlign] || 'flex-start'}]}>
        {on ? <ServiceInfo /> : null}
      </View>
    );
  };

  return (
    <View>
      {hasContent ? <View style={styles.header}>{['left', 'center', 'right'].map(renderArea)}</View> : null}
      {showSubheader ? <View style={styles.subheader}>{['left', 'center', 'right'].map(renderSubArea)}</View> : null}
    </View>
  );
}

/** Canal con foco y su programa actual / siguiente (renderServiceInfo de la web). */
function ServiceInfo() {
  const channel = useFocusedChannel();
  const {current, next} = getNowNext(channel);
  if (!current && !next) {
    return <Text style={styles.subEmpty}>{i18n.t('inicio.serviceInfo.empty')}</Text>;
  }
  const lcn = channel?.lcn ?? channel?.LCN;
  return (
    <View style={styles.serviceInfo}>
      <Text style={styles.subChannel} numberOfLines={1}>
        {lcn != null && lcn !== '' ? `${lcn} ` : ''}
        {channel?.name || ''}
      </Text>
      {[
        ['current', current],
        ['next', next],
      ].map(([key, ev]) =>
        ev ? (
          <View key={key} style={styles.subBlock}>
            <Text style={styles.subLabel}>
              {i18n.t(`inicio.serviceInfo.${key}`)}
              {ev.time ? `  ${ev.time}` : ''}
            </Text>
            <Text style={styles.subTitle} numberOfLines={1}>
              {ev.title || '—'}
            </Text>
            {ev.description ? (
              <Text style={styles.subDesc} numberOfLines={2}>
                {ev.description}
              </Text>
            ) : null}
          </View>
        ) : null,
      )}
    </View>
  );
}

// _home-shell.scss (.inicio-header) a 1920×1080.
const styles = createScaledStyles({
  header: {flexDirection: 'row', alignItems: 'center', minHeight: 116, paddingVertical: 8, paddingHorizontal: 44},
  col: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  logo: {height: 64, width: 240},
  time: {color: '#fff', fontSize: 32.8, fontVariant: ['tabular-nums']},
  // .inicio-subheader / .inicio-service-info
  subheader: {flexDirection: 'row', minHeight: 164, paddingVertical: 8, paddingHorizontal: 44},
  serviceInfo: {maxWidth: 1100},
  subChannel: {color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6},
  subBlock: {marginBottom: 6},
  subLabel: {color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: '600'},
  subTitle: {color: '#fff', fontSize: 24},
  subDesc: {color: 'rgba(255,255,255,0.75)', fontSize: 19},
  subEmpty: {color: 'rgba(255,255,255,0.7)', fontSize: 22},
});
