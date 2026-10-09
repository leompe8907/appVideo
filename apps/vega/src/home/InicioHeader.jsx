import * as React from 'react';
import {Image, View} from 'react-native';
import {getActiveBrandConfig, resolveHeaderActivado, resolveHomeShellHeaderEnabled, resolveShellMode} from '@appvideo/core/config/brandConfig';
import {Clock} from '../components/Clock';
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
 * (`showLogo`) y la hora (`showTime`). La subcabecera con el programa del
 * canal enfocado (`header.subheader`) todavía no está en Fire TV.
 */
export function InicioHeader() {
  const brand = getActiveBrandConfig();
  const theme = getTheme();
  const areas = brand?.header?.areas || {};
  const topbar = resolveShellMode(brand, true) === 'topbar';
  const hasContent = ['left', 'center', 'right'].some((k) => {
    const a = areas[k] || {};
    return a.enabled !== false && ((a.showLogo && !topbar) || a.showTime);
  });
  if (!hasContent) return null;

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

  return <View style={styles.header}>{['left', 'center', 'right'].map(renderArea)}</View>;
}

// _home-shell.scss (.inicio-header) a 1920×1080.
const styles = createScaledStyles({
  header: {flexDirection: 'row', alignItems: 'center', minHeight: 116, paddingVertical: 8, paddingHorizontal: 44},
  col: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  logo: {height: 64, width: 240},
  time: {color: '#fff', fontSize: 32.8, fontVariant: ['tabular-nums']},
});
