import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, BackHandler, Text, View} from 'react-native';
import {useIsFocused} from '@amazon-devices/react-navigation__native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useParentalGateStore} from '@appvideo/core/store/parentalGateStore';
import {filterBouquetsForInicio, filterBouquetsForTvRadioServices} from '@appvideo/core/services/tvDataService';
import {FullScreenImage} from '../components/FullScreenImage';
import {Sidebar, RAIL_WIDTH} from '../home/Sidebar';
import {BouquetWall} from '../home/BouquetWall';
import {AdZone} from '../home/AdZone';
import {VodPage} from '../vod/VodPage';
import {SearchPage} from '../search/SearchPage';
import {AccountPage} from '../account/AccountPage';
import {useHomeNavItems} from '../home/useHomeNavItems';
import {getHomeMemory, rememberPlayback, rememberSection} from '../homeMemory';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key, opts) => i18n.t(key, opts);

/**
 * Home de TV con el diseño de appVideo (spec §1-§3): menú lateral + muro de
 * bouquets. Inicio = bouquets principales; Canales = bouquets no principales.
 * Las demás secciones todavía no están portadas.
 */
export function HomeScreen({navigate}) {
  const theme = getTheme();
  const brand = getActiveBrandConfig();
  const epg = usePreloadStore((s) => s.epg);
  const loadEPG = usePreloadStore((s) => s.loadEPG);
  const {account, navItems} = useHomeNavItems();
  const [section, setSection] = useState(() => getHomeMemory().section);
  const isFocused = useIsFocused();
  const [preferredFocus, setPreferredFocus] = useState(null);
  // Con un modal de VOD abierto, Atrás lo cierra el modal (no vuelve a Inicio).
  const [vodModalOpen, setVodModalOpen] = useState(false);

  const ads = usePreloadStore((s) => s.ads);
  const loadAds = usePreloadStore((s) => s.loadAds);
  const adsEnabled = brand?.homeShell?.ads?.inicio === true;
  useEffect(() => {
    if (adsEnabled) loadAds();
  }, [adsEnabled, loadAds]);
  useEffect(() => {
    devLog('home: ads', ads.status, ads.error || '', 'top', ads.top?.length ?? 0, 'bottom', ads.bottom?.length ?? 0, 'total', ads.processed?.length ?? 0);
  }, [ads.status, ads.error, ads.top, ads.bottom, ads.processed]);

  useEffect(() => {
    loadEPG(brand);
  }, [brand, loadEPG]);

  const vod = usePreloadStore((s) => s.vod);
  const catchup = usePreloadStore((s) => s.catchup);
  useEffect(() => {
    devLog('home: vod', vod.status, vod.error || '', 'cats', vod.categories?.length ?? 0, 'vods', vod.allVods?.length ?? 0, 'rec', vod.vodRecommended?.length ?? 0);
  }, [vod.status, vod.error, vod.categories, vod.allVods, vod.vodRecommended]);
  useEffect(() => {
    devLog('home: catchup', catchup.status, catchup.error || '', 'groups', catchup.groups?.length ?? 0, 'recorded', catchup.recorded?.length ?? 0);
  }, [catchup.status, catchup.error, catchup.groups, catchup.recorded]);

  useEffect(() => {
    if (epg.status === 'ready') {
      const list = epg.bouquetsWithChannels || [];
      devLog('home: EPG listo,', list.length, 'bouquets');
      const sample = list[0]?.items?.[0]?.epgItems?.[0];
      if (sample) devLog('home: evento de muestra', JSON.stringify(sample).slice(0, 400));
    }
    if (epg.status === 'error') devLog('home: EPG error', epg.error);
  }, [epg.status, epg.bouquetsWithChannels, epg.error]);

  // Al volver del reproductor (el home queda montado debajo), foco al canal visto.
  useEffect(() => {
    if (!isFocused) {
      setPreferredFocus(null);
      return;
    }
    const m = getHomeMemory();
    setPreferredFocus(m.channelId != null ? {bouquetKey: m.bouquetKey, channelId: m.channelId} : null);
  }, [isFocused]);

  const selectSection = (key) => {
    rememberSection(key);
    setSection(key);
    setPreferredFocus(null);
  };

  // Atrás: desde otra sección vuelve a Inicio (como HomeInputDispatcher); en Inicio, el sistema cierra la app.
  useEffect(() => {
    if (!isFocused) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (section === 'inicio' || vodModalOpen) return false;
      selectSection('inicio');
      return true;
    });
    return () => sub.remove();
  });

  const bouquets = useMemo(() => {
    if (epg.status !== 'ready') return [];
    const list = epg.bouquetsWithChannels || [];
    return section === 'channels' ? filterBouquetsForTvRadioServices(list) : filterBouquetsForInicio(list);
  }, [epg.status, epg.bouquetsWithChannels, section]);

  // Reproducir pasa por el control parental (requestPlayChannel, como la web).
  const requestPlayChannel = useParentalGateStore((s) => s.requestPlayChannel);
  const requestPlayMedia = useParentalGateStore((s) => s.requestPlayMedia);
  const playChannel = (channel, bouquetKey) => {
    if (!channel) return;
    requestPlayChannel({
      channel,
      playFn: () => {
        rememberPlayback(bouquetKey ?? null, channel?.id ?? channel?.epgStreamId);
        navigate('player', {channel});
      },
    });
  };
  const playVod = (p) =>
    requestPlayMedia({
      item: p.item,
      ratingRaw: p.item?.parentalRating,
      title: t('parental.restrictedTitle'),
      message: t('parental.restrictedMessage'),
      playFn: () => navigate('vodplayer', p),
    });

  const play = (bouquet, index) => playChannel(bouquet.items[index], String(bouquet.bouquetId ?? bouquet.id));

  // Banner activado (adActivate.js de la web): stream_id=N → canal; vod_id=N → Películas.
  const activateAd = (ad) => {
    const generic = ad?.genericData != null ? String(ad.genericData) : '';
    const id = parseInt(generic.split('=')[1], 10);
    if (Number.isNaN(id)) return;
    if (generic.startsWith('stream_id')) {
      const stream = (epg.streams || []).find((s) => String(s?.id) === String(id));
      if (stream) playChannel(stream);
    } else if (generic.startsWith('vod_id=')) {
      selectSection('vod');
    }
  };

  // El canal recordado puede no estar en el bouquet recordado (zapping por LCN):
  // se busca el primer bouquet visible que lo tenga.
  const focusTarget = useMemo(() => {
    if (bouquets.length === 0) return null;
    const first = {bouquetKey: String(bouquets[0].bouquetId ?? bouquets[0].id), channelId: String(bouquets[0].items?.[0]?.id ?? bouquets[0].items?.[0]?.epgStreamId ?? 0)};
    if (!preferredFocus?.channelId) return first;
    const has = (b) => (b.items || []).some((c) => String(c?.id ?? c?.epgStreamId) === preferredFocus.channelId);
    const remembered = bouquets.find((b) => String(b.bouquetId ?? b.id) === preferredFocus.bouquetKey);
    const target = remembered && has(remembered) ? remembered : bouquets.find(has);
    return target ? {bouquetKey: String(target.bouquetId ?? target.id), channelId: preferredFocus.channelId} : first;
  }, [bouquets, preferredFocus]);

  let content;
  if (epg.status !== 'ready' && epg.status !== 'error') {
    const p = epg.progress || {};
    content = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.message}>{epg.status === 'finishing' ? t('preload.finishing') : t('preload.message')}</Text>
        {p.total ? <Text style={styles.sub}>{t('preload.channelsProgress', {current: p.current, total: p.total})}</Text> : null}
      </View>
    );
  } else if (epg.status === 'error' && bouquets.length === 0) {
    content = (
      <View style={styles.center}>
        <Text style={styles.error}>{epg.error || t('bouquet.errorLoad')}</Text>
      </View>
    );
  } else if (section === 'inicio' || section === 'channels') {
    content =
      bouquets.length > 0 ? (
        <View style={styles.inicio}>
          <BouquetWall
            bouquets={bouquets}
            onPlay={play}
            preferredFocus={focusTarget}
            header={section === 'inicio' && adsEnabled ? <AdZone ads={ads.top} position="top" onActivate={activateAd} /> : null}
          />
          {section === 'inicio' && adsEnabled ? <AdZone ads={ads.bottom} position="bottom" onActivate={activateAd} /> : null}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.sub}>{t('bouquet.noBouquets')}</Text>
        </View>
      );
  } else if (section === 'search') {
    content = (
      <SearchPage
        active={isFocused}
        onModalChange={setVodModalOpen}
        onPlayChannel={(channel) => playChannel(channel)}
        onPlayVod={playVod}
      />
    );
  } else if (section === 'vod') {
    content = <VodPage active={isFocused} onPlay={playVod} onModalChange={setVodModalOpen} />;
  } else if (section === 'account') {
    content = <AccountPage active={isFocused} navigate={navigate} />;
  } else {
    content = (
      <View style={styles.center}>
        <Text style={styles.message}>Próximamente</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <FullScreenImage source={theme.assets.background} />
      <View style={styles.content}>{content}</View>
      <Sidebar
        account={account}
        items={navItems}
        activeKey={section}
        onSelect={selectSection}
      />
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1},
  content: {flex: 1, marginLeft: RAIL_WIDTH},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  message: {color: '#fff', fontSize: 28, marginTop: 24},
  sub: {color: 'rgba(255,255,255,0.85)', fontSize: 20, marginTop: 12},
  error: {color: '#f8d7da', fontSize: 20, textAlign: 'center'},
  inicio: {flex: 1},
});
