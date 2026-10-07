import * as React from 'react';
import {useEffect, useState} from 'react';
import {ActivityIndicator, BackHandler, FlatList, Image, Pressable, ScrollView, TVFocusGuideView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {
  catchupGroupToChannel,
  fmtCatchupSchedule,
  getCatchupGroupKey,
  getCatchupGroupTitle,
  getCatchupId,
  getCatchupRailItemKey,
  getEventImage,
  getEventStartMs,
  getEventTitle,
} from '@appvideo/core/utils/catchupEvent';
import {FocusRing} from '../components/FocusRing';
import {EpgEventModal} from '../epg/EpgEventModal';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const ITEMS_PER_RAIL = 9;

function CatchupCard({event, onPress, hasTVPreferredFocus}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = getEventImage(event);
  const start = getEventStartMs(event);
  return (
    <View style={[styles.card, getCatchupId(event) == null && styles.unavailable]}>
      <Pressable onPress={onPress} hasTVPreferredFocus={hasTVPreferredFocus} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <View style={styles.poster}>
          <Image resizeMethod="resize" source={image && !failed ? {uri: image} : theme.assets.placeholder} style={styles.fill} resizeMode="cover" onError={() => setFailed(true)} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {getEventTitle(event) || '—'}
        </Text>
        {start != null ? (
          <Text style={styles.schedule} numberOfLines={2}>
            {fmtCatchupSchedule(start, i18n.language)}
          </Text>
        ) : null}
      </Pressable>
      <FocusRing visible={focused} radius={8} />
    </View>
  );
}

function SeeMoreCard({onPress}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <View style={[styles.poster, styles.more]}>
          <Text style={styles.plus}>+</Text>
        </View>
        <Text style={styles.title}>{t('catchup.seeMore')}</Text>
      </Pressable>
      <FocusRing visible={focused} radius={8} />
    </View>
  );
}

/**
 * Catchup (CatchupPage de la web, layout "rails", spec 3 §1): un carril por
 * canal (máx. 9 + "Ver más" con la grilla del canal), detalle del evento y
 * reproducción con getCatchupM3u8Url.
 * TODO: probar con una marca con catchup (la cuenta de INTV no tiene grupos).
 */
export function CatchupPage({onPlay, onModalChange, active = true}) {
  const brand = getActiveBrandConfig();
  const catchup = usePreloadStore((s) => s.catchup);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);
  const [grid, setGrid] = useState(null); // group
  const [detail, setDetail] = useState(null); // {event, group}

  useEffect(() => {
    if (catchup.status === 'idle') loadCatchup(brand);
  }, [catchup.status, brand, loadCatchup]);

  useEffect(() => {
    onModalChange?.(Boolean(grid || detail));
  }, [grid, detail, onModalChange]);

  useEffect(() => {
    if (!active || (!grid && !detail)) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detail) setDetail(null);
      else setGrid(null);
      return true;
    });
    return () => sub.remove();
  }, [active, grid, detail]);

  const groups = (catchup.groups || []).filter((g) => (g?.events || []).length > 0);
  const open = (event, group) => {
    setGrid(null);
    setDetail({event, group});
  };

  let body;
  if (catchup.status === 'loading' || catchup.status === 'idle') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.subtitle}>{t('catchup.loading')}</Text>
      </View>
    );
  } else if (catchup.status === 'error' && groups.length === 0) {
    body = (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{catchup.error || t('catchup.errorLoad')}</Text>
        <Pressable hasTVPreferredFocus style={styles.refresh} onPress={() => loadCatchup(brand, {force: true})}>
          <Text style={styles.refreshText}>{t('common.refresh')}</Text>
        </Pressable>
      </View>
    );
  } else if (groups.length === 0) {
    body = <Text style={styles.empty}>{t('catchup.empty')}</Text>;
  } else {
    body = (
      <ScrollView showsVerticalScrollIndicator={false}>
        {groups.map((group, gi) => {
          const events = group.events || [];
          const data = events.length > ITEMS_PER_RAIL ? [...events.slice(0, ITEMS_PER_RAIL), {__more: true}] : events;
          const gKey = getCatchupGroupKey(group, gi);
          return (
            <View key={gKey} style={styles.section}>
              <Text style={styles.railTitle}>{getCatchupGroupTitle(group, t('catchup.unknownChannel'))}</Text>
              <TVFocusGuideView trapFocusRight>
                <FlatList
                  horizontal
                  data={data}
                  keyExtractor={(e, i) => (e.__more ? 'more' : getCatchupRailItemKey(e, gKey, i))}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                  renderItem={({item, index}) =>
                    item.__more ? (
                      <SeeMoreCard onPress={() => setGrid(group)} />
                    ) : (
                      <CatchupCard event={item} hasTVPreferredFocus={!grid && !detail && gi === 0 && index === 0} onPress={() => open(item, group)} />
                    )
                  }
                />
              </TVFocusGuideView>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>{t('catchup.title')}</Text>
      {body}
      {grid ? (
        <View style={styles.modalOverlay}>
          <View style={styles.gridModal}>
            <Text style={styles.gridTitle}>{getCatchupGroupTitle(grid, t('catchup.unknownChannel'))}</Text>
            <FlatList
              data={grid.events || []}
              numColumns={5}
              keyExtractor={(e, i) => getCatchupRailItemKey(e, 'grid', i)}
              renderItem={({item, index}) => (
                <View style={styles.gridCell}>
                  <CatchupCard event={item} hasTVPreferredFocus={index === 0} onPress={() => open(item, grid)} />
                </View>
              )}
            />
          </View>
        </View>
      ) : null}
      {detail ? (
        <EpgEventModal
          context="catchup"
          channel={catchupGroupToChannel(detail.group)}
          event={detail.event}
          onPlayCatchup={(event) => {
            setDetail(null);
            onPlay(event, detail.group);
          }}
        />
      ) : null}
    </View>
  );
}

// _catchup.scss / epg-common.scss a 1920×1080 (spec 3 §1-2).
const styles = createScaledStyles({
  page: {flex: 1, paddingTop: 19.44, paddingHorizontal: 19.44, paddingBottom: 23.76, backgroundColor: 'rgba(0,0,0,0.6)'},
  pageTitle: {color: '#fff', fontSize: 23.76, fontWeight: '800', marginBottom: 14},
  subtitle: {color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 12},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  errorBox: {padding: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)', gap: 12},
  errorText: {color: 'rgba(255,255,255,0.85)', fontSize: 16},
  refresh: {alignSelf: 'flex-start', paddingVertical: 10.8, paddingHorizontal: 15.12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.12)'},
  refreshText: {color: '#fff', fontSize: 16},
  empty: {color: 'rgba(255,255,255,0.7)', fontSize: 16, paddingVertical: 14},
  section: {marginBottom: 12},
  railTitle: {color: 'rgba(255,255,255,0.95)', fontSize: 16.8, fontWeight: '600', marginTop: 12, marginBottom: 8},
  rail: {paddingVertical: 20, paddingRight: 28, gap: 24, paddingLeft: 24},
  card: {width: 184},
  unavailable: {opacity: 0.45},
  poster: {width: 184, height: 103.5, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(40,40,40,0.8)', overflow: 'hidden'},
  more: {alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)'},
  plus: {color: 'rgba(255,255,255,0.85)', fontSize: 40, fontWeight: '300'},
  fill: {width: '100%', height: '100%'},
  title: {color: '#fff', fontSize: 13.6, marginTop: 5.6},
  schedule: {color: 'rgba(255,255,255,0.72)', fontSize: 11.52, marginTop: 3.2},
  modalOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)'},
  gridModal: {width: 1200, maxHeight: 950, paddingTop: 18, paddingHorizontal: 20, paddingBottom: 22, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(18,20,28,0.98)'},
  gridTitle: {color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16},
  gridCell: {width: 218, marginBottom: 16},
  detail: {width: 1152, height: 864, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgb(20,20,20)', justifyContent: 'space-around'},
  detailHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12},
  detailLogo: {width: 192, height: 160, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)'},
  detailHeaderText: {flex: 1},
  detailChannel: {color: '#fff', fontSize: 40, fontWeight: '700'},
  detailMeta: {color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '700'},
  detailImage: {width: 180, height: 110, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)'},
  detailBody: {flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 8},
  detailTitle: {color: '#fff', fontSize: 40, fontWeight: '700'},
  badge: {alignSelf: 'flex-start', color: '#fff', fontSize: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)'},
  descriptionScroll: {flex: 1},
  description: {color: 'rgba(255,255,255,0.85)', fontSize: 20.8, lineHeight: 31.2},
  footer: {paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18, flexDirection: 'row'},
  playBtn: {paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.08)'},
  playText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  notAvailable: {color: 'rgba(255,255,255,0.7)', fontSize: 15.2},
});
