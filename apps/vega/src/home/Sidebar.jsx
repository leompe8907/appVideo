import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {Image, Pressable, TVFocusGuideView, Text, View} from 'react-native';
import {getTheme} from '../theme';
import {registerFocusTarget} from '../focusTargets';
import {createScaledStyles, px} from '../scaledStyles';

const ICONS = {
  account: require('../../assets/icons/nav-account.png'),
  search: require('../../assets/icons/nav-search.png'),
  home: require('../../assets/icons/nav-home.png'),
  channels: require('../../assets/icons/nav-channels.png'),
  movies: require('../../assets/icons/nav-movies.png'),
  guide: require('../../assets/icons/nav-guide.png'),
  catchup: require('../../assets/icons/nav-catchup.png'),
};

// Medidas de _home-shell(-tv).scss a 1920×1080 (spec §1.2).
export const RAIL_WIDTH = 115.2;
const PANEL_WIDTH = 480;
const COLLAPSE_DELAY_MS = 80;

const TEXT_IDLE = 'rgba(255,255,255,0.42)';
const TEXT_ACTIVE = '#ffffff';

function SidebarItem({item, active, expanded, focused, onFocus, onBlur, onPress, accent, pressRef}) {
  const highlighted = active || focused;
  const color = expanded || highlighted ? TEXT_ACTIVE : TEXT_IDLE;
  return (
    <Pressable ref={pressRef} onPress={onPress} onFocus={onFocus} onBlur={onBlur} style={styles.item}>
      <View style={styles.iconCell}>
        <Image source={ICONS[item.icon]} style={[styles.icon, {tintColor: color}]} />
        {!expanded && highlighted ? <View style={[styles.railIndicator, {backgroundColor: accent}]} /> : null}
      </View>
      {expanded ? (
        <View style={styles.labelCell}>
          <Text style={[styles.label, {color}]} numberOfLines={1}>
            {item.label}
          </Text>
          {highlighted ? <View style={[styles.underline, {backgroundColor: accent}]} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Menú lateral de TV (Sidebar.jsx, spec §1): riel de íconos que se expande
 * como panel superpuesto mientras tiene el foco. Sin anillo de foco: el
 * foco se marca con texto blanco y la barra/subrayado de acento.
 */
export function Sidebar({account, items, activeKey, onSelect}) {
  const theme = getTheme();
  const [focusedKey, setFocusedKey] = useState(null);
  const blurTimer = useRef(null);
  const activeRef = useRef(null);
  const expanded = focusedKey != null;

  // Otras pantallas pueden mandar el foco al menú (ítem activo).
  useEffect(() => {
    registerFocusTarget('sidebar', activeRef);
    return () => registerFocusTarget('sidebar', null);
  }, []);

  const handleFocus = (key) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocusedKey(key);
  };
  const handleBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    // Si el foco pasa a otro ítem del menú, su onFocus llega antes del timer.
    blurTimer.current = setTimeout(() => setFocusedKey(null), COLLAPSE_DELAY_MS);
  };

  const renderItem = (item) => (
    <SidebarItem
      key={item.key}
      item={item}
      active={item.key === activeKey}
      pressRef={item.key === activeKey ? activeRef : undefined}
      expanded={expanded}
      focused={focusedKey === item.key}
      accent={theme.focusColor}
      onFocus={() => handleFocus(item.key)}
      onBlur={handleBlur}
      // No se colapsa al elegir: si la sección nueva toma el foco, el onBlur
      // lo colapsa; si no (misma sección), el foco sigue acá y debe verse.
      onPress={() => onSelect(item.key)}
    />
  );

  return (
    <>
      {expanded ? <View pointerEvents="none" style={styles.dim} /> : null}
      {/* ▲▼ no salen del menú (como Sidebar.jsx); al entrar vuelve al último ítem enfocado. */}
      <TVFocusGuideView
        autoFocus
        trapFocusUp
        trapFocusDown
        style={[styles.sidebar, {width: px(expanded ? PANEL_WIDTH : RAIL_WIDTH), backgroundColor: theme.sidebar.panel}]}>
        <View style={styles.accountGroup}>{renderItem(account)}</View>
        <View style={styles.navGroup}>{items.map(renderItem)}</View>
      </TVFocusGuideView>
    </>
  );
}

const styles = createScaledStyles({
  sidebar: {position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 30, paddingTop: 10.4, paddingBottom: 16},
  dim: {position: 'absolute', left: PANEL_WIDTH, right: 0, top: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(12,14,20,0.18)'},
  accountGroup: {marginBottom: 5.6},
  navGroup: {flex: 1, justifyContent: 'center'},
  item: {flexDirection: 'row', alignItems: 'center', minHeight: 96, paddingVertical: 12.48, marginBottom: 10.4},
  iconCell: {width: RAIL_WIDTH, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch'},
  icon: {width: 38.4, height: 38.4},
  railIndicator: {position: 'absolute', bottom: -6, width: 25.6, height: 2, borderRadius: 1},
  labelCell: {flex: 1, paddingRight: 16, alignItems: 'flex-start'},
  label: {fontSize: 38.4, fontWeight: '400'},
  underline: {alignSelf: 'stretch', height: 2, marginTop: 5.6},
});
