import * as React from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, FlatList, Image, Pressable, Text, TextInput, View, useTVEventHandler} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {getSearchDebounceMs, searchAll} from '@appvideo/core/services/searchService';
import {buildSearchResultKey, useSearchSessionStore} from '@appvideo/core/store/searchSessionStore';
import {RemoteImage} from '../components/RemoteImage';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {formatTime} from '../epg';
import {VodDetail} from '../vod/VodDetail';
import {focusTarget} from '../focusTargets';

const t = (key, opts) => i18n.t(key, opts);
const SECTION_ORDER = ['service', 'vod', 'catchup', 'epg'];
const TAB_LABEL = {all: 'search.tabAll', service: 'search.tabServices', epg: 'search.tabEpg', vod: 'search.tabVod', catchup: 'search.tabCatchup'};
const SECTION_LABEL = {service: 'search.sectionServices', vod: 'search.sectionVod', catchup: 'search.sectionCatchup', epg: 'search.sectionEpg'};

/** Colores de BRAND `ui.search.*` (applySearchTheme de la web). */
function searchColors() {
  const s = getActiveBrandConfig()?.ui?.search || {};
  return {
    panel: s.panelBg || 'rgba(248,249,255,0.98)',
    headerBg: s.header?.bg || '#e8ebff',
    inputBg: s.input?.bg || 'rgba(255,255,255,0.85)',
    inputText: s.input?.text || '#1a1a2e',
    inputPlaceholder: s.input?.placeholder || 'rgba(26,26,46,0.45)',
    inputFocusedBg: s.input?.focusedBg || '#ffffff',
    inputFocusedBorder: s.input?.focusedBorder || '#3355FF',
    clearBg: s.clearButton?.bg || '#dc3545',
    clearText: s.clearButton?.text || '#ffffff',
    tabBg: s.tabs?.bg || 'rgba(51,85,255,0.1)',
    tabText: s.tabs?.text || 'rgba(26,26,46,0.85)',
    tabFocusBg: s.tabs?.hoverBg || 'rgba(51,85,255,0.18)',
    tabActiveBg: s.tabs?.activeBg || '#3355FF',
    tabActiveText: s.tabs?.activeText || '#ffffff',
    tabActiveFocusBg: s.tabs?.activeHoverBg || '#2244dd',
    areaBg: s.results?.areaBg || '#eceef8',
    cardBg: s.results?.cardBg || '#ffffff',
    cardBorder: s.results?.cardBorder || '#d0d5f0',
    cardFocusBg: s.results?.cardHoverBg || '#f0f2ff',
    cardFocusBorder: s.results?.cardFocusBorder || '#3355FF',
    title: s.results?.titleText || '#1a1a2e',
    meta: s.results?.metaText || 'rgba(26,26,46,0.65)',
    sectionBg: s.results?.sectionTitleBg || 'rgba(51,85,255,0.08)',
    thumbBg: s.results?.thumbBg || 'rgba(51,85,255,0.06)',
    empty: s.empty?.text || 'rgba(26,26,46,0.75)',
    count: s.empty?.countText || 'rgba(26,26,46,0.55)',
  };
}

function ResultCard({item, colors, onPress, hasTVPreferredFocus, onFocus}) {
  const [focused, setFocused] = useState(false);
  const theme = getTheme();
  const meta = item.vodSearchMeta;
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.card,
        {backgroundColor: focused ? colors.cardFocusBg : colors.cardBg, borderColor: focused ? colors.cardFocusBorder : colors.cardBorder},
        focused && styles.cardFocused,
      ]}>
      <View style={[item.type === 'epg' ? styles.thumbEpg : styles.thumb, {backgroundColor: colors.thumbBg}]}>
        <RemoteImage uri={item.logo} fallback={theme.assets.placeholder} style={styles.fill} resizeMode="contain" />
      </View>
      {item.type === 'epg' ? (
        <>
          <Text style={[styles.meta, {color: colors.meta}]} numberOfLines={2}>
            {item.lcn != null ? `${item.lcn} ` : ''}
            {item.channelName}
          </Text>
          <Text style={[styles.name, styles.epgTitle, {color: colors.title}]} numberOfLines={3}>
            {item.name}
          </Text>
          {item.startMs ? <Text style={[styles.meta, {color: colors.meta}]}>{`${formatTime(item.startMs)} - ${formatTime(item.endMs)}`}</Text> : null}
        </>
      ) : (
        <>
          <Text style={[styles.name, {color: colors.title}]} numberOfLines={2}>
            {item.type === 'service' && item.lcn != null ? <Text style={styles.lcn}>{`${item.lcn} `}</Text> : null}
            {item.name}
          </Text>
          {meta?.type ? (
            <Text style={[styles.meta, {color: colors.meta}]} numberOfLines={1}>
              {meta.type === 'actor'
                ? t('search.vodMetaActor', {name: meta.value})
                : meta.type === 'director'
                  ? t('search.vodMetaDirector', {name: meta.value})
                  : t('search.vodMetaYear', {year: meta.value})}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function Pill({label, active, colors, onPress}) {
  const [focused, setFocused] = useState(false);
  const bg = active ? (focused ? colors.tabActiveFocusBg : colors.tabActiveBg) : focused ? colors.tabFocusBg : colors.tabBg;
  return (
    <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.tab, {backgroundColor: bg}]}>
      <Text style={[styles.tabText, {color: active ? colors.tabActiveText : colors.tabText}]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Buscador (SearchPage de la web, spec 2 §4): búsqueda local sobre canales,
 * VOD y catchup ya cargados, con pestañas y grilla de 6 columnas. En Fire TV
 * se usa el teclado del sistema (OK sobre el campo).
 */
export function SearchPage({onPlayChannel, onPlayVod, onModalChange, active = true}) {
  const brand = getActiveBrandConfig();
  const colors = searchColors();
  const epg = usePreloadStore((s) => s.epg);
  const vod = usePreloadStore((s) => s.vod);
  const catchup = usePreloadStore((s) => s.catchup);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);
  const session = useSearchSessionStore();
  const [text, setText] = useState(session.query || '');
  const [query, setQueryDebounced] = useState(session.query || '');
  const [inputFocused, setInputFocused] = useState(false);
  const clearRef = useRef(null);

  // Con texto, ◀ ▶ dentro del campo sólo mueven el cursor y el foco no sale:
  // ▶ va a "Limpiar" y ◀ al menú lateral.
  useTVEventHandler((evt) => {
    if (!active || !inputFocused || !evt || evt.eventKeyAction !== 0) return;
    if (evt.eventType === 'right') clearRef.current?.requestTVFocus?.();
    else if (evt.eventType === 'left') focusTarget('sidebar');
  });
  const [clearFocused, setClearFocused] = useState(false);
  const epgEnabled = brand?.EPG?.enabled !== false;
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    onModalChange?.(Boolean(detail));
  }, [detail, onModalChange]);

  // Atrás cierra el detalle (sólo con el home en primer plano).
  useEffect(() => {
    if (!active || !detail) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetail(null);
      return true;
    });
    return () => sub.remove();
  }, [active, detail]);

  useEffect(() => {
    session.bindBrand?.(brand?.brand);
    if (session.isExpired?.()) session.reset?.();
    if (vod.status === 'idle') loadVOD(brand, {t});
    if (brand?.catchup?.enabled !== false && catchup.status === 'idle') loadCatchup(brand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQueryDebounced(text);
      session.setQuery(text);
    }, getSearchDebounceMs());
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const results = useMemo(() => {
    const all = searchAll({
      query,
      services: epg.streams || [],
      vods: vod.allVods || [],
      catchupGroups: catchup.groups || [],
      vodDrmBaseUrl: brand?.drm,
    });
    return epgEnabled ? all : all.filter((r) => r.type !== 'epg');
  }, [query, epg.streams, vod.allVods, catchup.groups, brand?.drm, epgEnabled]);

  const byType = useMemo(() => {
    const m = {};
    results.forEach((r) => (m[r.type] = m[r.type] || []).push(r));
    return m;
  }, [results]);
  const types = SECTION_ORDER.filter((k) => byType[k]?.length);
  const tabs = [...(types.length >= 2 ? ['all'] : []), ...types];
  const activeTab = tabs.includes(session.activeTab) ? session.activeTab : tabs[0] || 'all';
  const shown = activeTab === 'all' ? results : byType[activeTab] || [];

  const open = (item) => {
    session.setFocusedResultKey(buildSearchResultKey(item));
    if (item.type === 'service') onPlayChannel(item.raw);
    else if (item.type === 'vod') setDetail(item.raw);
    // TODO: catchup / EPG (EpgEventModal) cuando se porte Catchup.
  };

  const restoredKey = session.focusedResultKey;

  return (
    <View style={[styles.container, {backgroundColor: colors.panel}]}>
      <View style={[styles.header, {backgroundColor: colors.headerBg}]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.inputPlaceholder}
          autoCorrect={false}
          autoCapitalize="none"
          hasTVPreferredFocus={!restoredKey || results.length === 0}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          style={[
            styles.input,
            {color: colors.inputText, backgroundColor: inputFocused ? colors.inputFocusedBg : colors.inputBg},
            inputFocused && {borderColor: colors.inputFocusedBorder},
          ]}
        />
        <Pressable
          ref={clearRef}
          onPress={() => setText('')}
          onFocus={() => setClearFocused(true)}
          onBlur={() => setClearFocused(false)}
          style={[styles.clear, {backgroundColor: colors.clearBg}, clearFocused && {borderColor: colors.inputFocusedBorder}]}>
          <Text style={[styles.clearText, {color: colors.clearText}]}>{t('search.clear')}</Text>
        </Pressable>
      </View>

      {query.trim() && tabs.length > 0 ? (
        <View style={styles.tabs}>
          {tabs.map((k) => (
            <Pill key={k} label={t(TAB_LABEL[k])} active={k === activeTab} colors={colors} onPress={() => session.setActiveTab(k)} />
          ))}
        </View>
      ) : null}

      <View style={[styles.results, {backgroundColor: colors.areaBg}]}>
        {!query.trim() ? (
          <Text style={[styles.empty, {color: colors.empty}]}>{t('search.typeToSearch')}</Text>
        ) : shown.length === 0 ? (
          <Text style={[styles.empty, {color: colors.empty}]}>{t('search.noResults')}</Text>
        ) : (
          <FlatList
            data={shown}
            numColumns={6}
            keyExtractor={(r, i) => buildSearchResultKey(r) || String(i)}
            ListHeaderComponent={
              <Text style={[styles.count, {color: colors.count}]}>
                {`${shown.length} ${shown.length === 1 ? t('search.result') : t('search.results')}`}
              </Text>
            }
            renderItem={({item}) => (
              <View style={styles.cell}>
                <ResultCard
                  item={item}
                  colors={colors}
                  hasTVPreferredFocus={restoredKey === buildSearchResultKey(item)}
                  onPress={() => open(item)}
                />
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      {detail ? <VodDetail item={detail} categories={vod.categories} onPlay={onPlayVod} /> : null}
    </View>
  );
}

// _search.scss a 1920×1080 (spec 2 §4.1).
const styles = createScaledStyles({
  container: {flex: 1, margin: 12.96, padding: 19.44, borderRadius: 10},
  header: {flexDirection: 'row', alignItems: 'center', borderRadius: 5, padding: 10, marginBottom: 12},
  input: {flex: 1, height: 62.4, fontSize: 24, paddingHorizontal: 10, borderRadius: 8, borderWidth: 2, borderColor: 'transparent', marginRight: 10},
  clear: {paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)'},
  clearText: {fontSize: 17.6, fontWeight: '600'},
  tabs: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', minHeight: 72, marginBottom: 16},
  tab: {borderRadius: 999, paddingVertical: 12, paddingHorizontal: 26, marginRight: 24, marginBottom: 13.6},
  tabText: {fontSize: 23.2},
  results: {flex: 1, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16},
  count: {fontSize: 24, fontWeight: '600', marginBottom: 12, paddingHorizontal: 6},
  empty: {fontSize: 22.4, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 8},
  cell: {width: '16.66%', padding: 5},
  card: {minHeight: 384, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1},
  cardFocused: {transform: [{scale: 1.04}]},
  thumb: {width: '100%', height: 216, borderRadius: 5, overflow: 'hidden'},
  thumbEpg: {width: '100%', height: 120, borderRadius: 5, overflow: 'hidden'},
  fill: {width: '100%', height: '100%'},
  name: {marginTop: 8, fontSize: 24, lineHeight: 32.4, textAlign: 'center'},
  epgTitle: {fontWeight: '700'},
  lcn: {fontSize: 20.4, fontWeight: '700', opacity: 0.75},
  meta: {marginTop: 4, fontSize: 20.8, textAlign: 'center'},
});
