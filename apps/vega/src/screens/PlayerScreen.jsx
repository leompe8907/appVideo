import * as React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, BackHandler, FlatList, Image, Pressable, Text, View, useTVEventHandler} from 'react-native';
import {KeplerCaptionsView, KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig, isParentalControlEnabledForBrand} from '@appvideo/core/config/brandConfig';
import {useParentalStore} from '@appvideo/core/store/parentalStore';
import {getChannelStableId} from '@appvideo/core/utils/channelId';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useParentalGateStore} from '@appvideo/core/store/parentalGateStore';
import {buildZappingChannelList} from '@appvideo/core/utils/channelZappingList';
import {buildChannelLogoUrl} from '@appvideo/core/utils/bouquetLayoutConfig';
import {getCurrentEpgEvent, getEpgEventTimeBoundsMs, getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {VegaHlsPlayer} from '../player/VegaHlsPlayer';
import {TracksPanel, hasTrackOptions} from '../player/TracksPanel';
import {Clock} from '../components/Clock';
import {FocusRing} from '../components/FocusRing';
import {formatTime} from '../epg';
import {getTheme} from '../theme';
import {createScaledStyles, px} from '../scaledStyles';
import {rememberChannel, rememberSection} from '../homeMemory';
import {devLog} from '../devLog';

const t = (key, opts) => i18n.t(key, opts);
const ZAP_DELAY_MS = 600;
const ROW_HEIGHT = 92;

const ICONS = {
  back: require('../../assets/icons/app-back.png'),
  list: require('../../assets/icons/app-list.png'),
  menu: require('../../assets/icons/app-menu.png'),
  info: require('../../assets/icons/app-info.png'),
  lock: require('../../assets/icons/app-lock.png'),
  lockOpen: require('../../assets/icons/app-lockOpen.png'),
  subtitles: require('../../assets/icons/app-subtitles.png'),
  close: require('../../assets/icons/app-close.png'),
};

const channelId = (c) => String(c?.id ?? c?.epgStreamId ?? '');

function logoOf(channel, theme) {
  const url = buildChannelLogoUrl(channel, getActiveBrandConfig()?.drm) || channel?.img || channel?.imageUrl || channel?.logoUrl;
  return url ? {uri: url} : theme.assets.placeholder;
}

/** Programa actual y siguiente (el HUD re-renderiza cada 1 s). */
function nowNext(channel) {
  const items = channel?.epgItems || [];
  const current = getCurrentEpgEvent(items);
  if (!current) return {now: null, next: null};
  const i = items.indexOf(current);
  const next = i >= 0 ? items[i + 1] : null;
  const b = getEpgEventTimeBoundsMs(current);
  const lang = current.languages?.[0] || {};
  return {
    now: {
      title: getEpgEventTitle(current),
      range: b ? `${formatTime(b.startMs)} - ${formatTime(b.endMs)}` : '',
      description: lang.extendedDescription || lang.description || current.description || '',
    },
    next: next ? {title: getEpgEventTitle(next)} : null,
  };
}

function HudButton({icon, onPress, hasTVPreferredFocus, onFocus}) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        style={styles.iconBtn}>
        <Image resizeMethod="resize" source={ICONS[icon]} style={styles.iconImg} />
      </Pressable>
      <FocusRing visible={focused} radius={999} />
    </View>
  );
}

function ChannelRow({channel, active, onPress, hasTVPreferredFocus, theme}) {
  const [focused, setFocused] = useState(false);
  const program = getEpgEventTitle(getCurrentEpgEvent(channel?.epgItems));
  return (
    <View style={styles.rowWrap}>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.row, active && styles.rowActive]}>
        <Image resizeMethod="resize" source={logoOf(channel, theme)} style={styles.rowLogo} resizeMode="contain" />
        <Text style={styles.rowLcn}>{channel?.lcn ?? ''}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowName} numberOfLines={1}>
            {channel?.name}
          </Text>
          {program ? (
            <Text style={styles.rowProgram} numberOfLines={1}>
              {program}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <FocusRing visible={focused} radius={12} />
    </View>
  );
}

/**
 * Reproductor en vivo con el HUD de appVideo (PlayerHud, spec §4): barra
 * superior (Volver, Canales, Info, reloj), barra inferior con logo, nombre y
 * programa actual/siguiente, auto-ocultado (`player.hudAutoHideMs`), zapping
 * por LCN con ▲▼ (`player.channelChangeWithArrows`) y "Listado de canales".
 */
export function PlayerScreen({params, navigate}) {
  const theme = getTheme();
  const brand = getActiveBrandConfig();
  const playerCfg = brand?.player || {};
  const epgEnabled = brand?.EPG?.enabled !== false;
  const parentalEnabled = isParentalControlEnabledForBrand(brand);
  const hideMs = Math.max(500, Number(playerCfg.hudAutoHideMs) || 6000);
  const arrowsZap = playerCfg.channelChangeWithArrows !== false;
  const closeListOnSelect = playerCfg.closeChannelSidebarOnSelect === true;

  const streams = usePreloadStore((s) => s.epg.streams);
  const channels = useMemo(() => {
    const list = buildZappingChannelList(streams);
    return list.length > 0 ? list : params?.channel ? [params.channel] : [];
  }, [streams, params?.channel]);

  const [index, setIndex] = useState(() => {
    const i = channels.findIndex((c) => channelId(c) === channelId(params?.channel));
    return i >= 0 ? i : 0;
  });
  const channel = channels[index];

  const [state, setState] = useState('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [hudVisible, setHudVisible] = useState(true);
  const [panel, setPanel] = useState(null); // null | 'channels' | 'info' | 'tracks'
  const [tracks, setTracks] = useState(null);
  const [, setTick] = useState(0);
  const player = useRef(null);
  // Liberación del reproductor anterior en curso (zapping).
  const releasing = useRef(Promise.resolve());
  const handles = useRef({surface: null, caption: null});
  const hideTimer = useRef(null);

  // Reloj y now/next se re-evalúan cada segundo.
  useEffect(() => {
    const timer = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const showHud = useCallback(() => {
    setHudVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHudVisible(false), hideMs);
  }, [hideMs]);

  // Nunca se oculta con un panel abierto ni mientras no está reproduciendo.
  useEffect(() => {
    if (panel || state !== 'playing') {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setHudVisible(true);
    } else {
      showHud();
    }
  }, [panel, state, showHud]);

  useEffect(() => () => hideTimer.current && clearTimeout(hideTimer.current), []);

  // Cambiar de canal pasa por el control parental (como usePlayerChannelZapping).
  const requestPlayChannel = useParentalGateStore((s) => s.requestPlayChannel);
  const requestSetupPin = useParentalGateStore((s) => s.requestSetupPin);
  const parental = useParentalStore();
  const currentChannelId = getChannelStableId(channel);
  const currentChannelBlocked = Boolean(currentChannelId) && parental.isChannelBlocked(currentChannelId);

  // Bloquear/desbloquear el canal actual (toggleCurrentChannelBlock de la web):
  // bloquear sin PIN pide configurarlo; desbloquear pide el PIN.
  const toggleCurrentChannelBlock = () => {
    if (!currentChannelId) return;
    if (!currentChannelBlocked && parental.hasPinConfigured() !== true) {
      requestSetupPin({channel, title: t('parental.title'), message: t('parental.setupPinMessage')});
      return;
    }
    const doToggle = () => parental.toggleBlock(currentChannelId);
    if (currentChannelBlocked && parental.enabled && parental.hasPinConfigured()) {
      requestPlayChannel({
        channel,
        purpose: 'action',
        title: t('parental.title'),
        message: t('parental.confirmChangeMessage'),
        playFn: doToggle,
      });
      return;
    }
    if (!currentChannelBlocked && !parental.enabled) parental.setEnabled(true);
    doToggle();
  };

  const goTo = useCallback(
    (next) => requestPlayChannel({channel: channels[next], playFn: () => setIndex(next)}),
    [channels, requestPlayChannel],
  );
  const zap = useCallback(
    (delta) => {
      const n = channels.length;
      if (n > 1) goTo((index + delta + n) % n);
    },
    [channels.length, index, goTo],
  );

  useTVEventHandler((evt) => {
    if (!evt || evt.eventKeyAction === 1 || panel) return; // el panel maneja su propio foco
    const type = evt.eventType;
    if ((type === 'up' || type === 'down') && arrowsZap) {
      zap(type === 'up' ? 1 : -1); // ▲ siguiente, ▼ anterior (como la web)
      showHud();
    } else if (type === 'channelUp' || type === 'channelDown') {
      zap(type === 'channelUp' ? 1 : -1);
      showHud();
    } else if (['up', 'down', 'left', 'right', 'select'].includes(type)) {
      showHud();
    }
  });

  // Atrás: cierra el panel abierto; si no hay, el stack vuelve al home.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!panel) return false;
      setPanel(null);
      return true;
    });
    return () => sub.remove();
  }, [panel]);

  // Una instancia de reproductor por canal; el cambio espera un poco para no
  // abrir cada canal intermedio al mantener apretada la flecha.
  useEffect(() => {
    if (!channel?.url) {
      setState('error');
      return undefined;
    }
    let cancelled = false;
    rememberChannel(channelId(channel));
    setState('loading');
    setTracks(null);
    const timer = setTimeout(async () => {
      // No crear el reproductor nuevo hasta liberar el anterior (memoria).
      await releasing.current;
      if (cancelled) return;
      const p = new VegaHlsPlayer({
        onState: (s, detail) => {
          if (cancelled) return;
          if (s === 'error') devLog('player: error', channel.name, detail);
          setState(s);
        },
        onTracks: (next) => {
          if (!cancelled) setTracks(next);
        },
      });
      player.current = p;
      if (handles.current.surface) p.setSurfaceHandle(handles.current.surface);
      if (handles.current.caption) p.setCaptionViewHandle(handles.current.caption);
      devLog('player: cargando', channel.name);
      p.load(channel.url).catch((e) => {
        devLog('player: load', e?.message);
        if (!cancelled) setState('error');
      });
    }, ZAP_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      const p = player.current;
      player.current = null;
      if (p) releasing.current = p.destroy().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, retryToken]);

  const {now, next} = nowNext(channel);

  return (
    <View style={styles.container}>
      <KeplerVideoSurfaceView
        style={styles.surface}
        onSurfaceViewCreated={(h) => {
          handles.current.surface = h;
          player.current?.setSurfaceHandle(h);
        }}
        onSurfaceViewDestroyed={(h) => {
          player.current?.clearSurfaceHandle(h);
          handles.current.surface = null;
        }}
      />
      <KeplerCaptionsView
        onCaptionViewCreated={(h) => {
          handles.current.caption = h;
          player.current?.setCaptionViewHandle(h);
        }}
        show={Boolean(tracks?.textEnabled)}
        style={styles.captions}
      />

      {state === 'loading' || state === 'buffering' ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.center}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('player.playbackError')}</Text>
            <Pressable
              hasTVPreferredFocus
              onPress={() => setRetryToken((x) => x + 1)}
              style={[styles.errorBtn, {backgroundColor: theme.primary}]}>
              <Text style={styles.errorBtnText}>{t('player.retry')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {hudVisible ? (
        <>
          <View style={styles.topbar}>
            <View style={styles.topGroup}>
              <HudButton icon="back" hasTVPreferredFocus={!panel && state !== 'error'} onPress={() => navigate('back')} onFocus={showHud} />
              {epgEnabled ? (
                <HudButton
                  icon="list"
                  onPress={() => {
                    rememberSection('epg');
                    navigate('back');
                  }}
                  onFocus={showHud}
                />
              ) : null}
              {parentalEnabled ? (
                <HudButton icon={currentChannelBlocked ? 'lockOpen' : 'lock'} onPress={toggleCurrentChannelBlock} onFocus={showHud} />
              ) : null}
              <HudButton icon="menu" onPress={() => setPanel('channels')} onFocus={showHud} />
              <HudButton icon="info" onPress={() => setPanel('info')} onFocus={showHud} />
              {hasTrackOptions(tracks) ? <HudButton icon="subtitles" onPress={() => setPanel('tracks')} onFocus={showHud} /> : null}
            </View>
            <View style={styles.clock}>
              <Clock style={styles.clockText} />
            </View>
          </View>

          {channel ? (
            <View style={styles.bottombar} pointerEvents="none">
              <Image resizeMethod="resize" source={logoOf(channel, theme)} style={styles.logo} resizeMode="contain" />
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {channel.lcn != null ? <Text style={styles.lcn}>{`${channel.lcn}   `}</Text> : null}
                  {channel.name}
                </Text>
                {now ? (
                  <Text style={styles.program} numberOfLines={1}>
                    <Text style={styles.programLabel}>En este momento: </Text>
                    {now.title}
                  </Text>
                ) : null}
                {next ? (
                  <Text style={styles.program} numberOfLines={1}>
                    <Text style={styles.programLabel}>Siguiente: </Text>
                    {next.title}
                  </Text>
                ) : null}
              </View>
              {now?.range ? <Text style={styles.range}>{now.range}</Text> : null}
            </View>
          ) : null}
        </>
      ) : null}

      {panel === 'channels' ? (
        <View style={styles.panelOverlay}>
          <View style={styles.channelPanel}>
            <Text style={styles.panelTitle}>Listado de canales</Text>
            <FlatList
              data={channels.slice(0, 400)}
              keyExtractor={(c, i) => channelId(c) || String(i)}
              initialScrollIndex={Math.min(index, Math.max(0, Math.min(channels.length, 400) - 1))}
              getItemLayout={(_, i) => ({length: px(ROW_HEIGHT + 8), offset: px(ROW_HEIGHT + 8) * i, index: i})}
              renderItem={({item, index: i}) => (
                <ChannelRow
                  channel={item}
                  theme={theme}
                  active={i === index}
                  hasTVPreferredFocus={i === index}
                  onPress={() => {
                    goTo(i);
                    if (closeListOnSelect) setPanel(null);
                  }}
                />
              )}
              contentContainerStyle={styles.panelList}
            />
          </View>
        </View>
      ) : null}

      {panel === 'tracks' ? (
        <TracksPanel
          tracks={tracks}
          onSelectAudio={(id) => player.current?.selectAudioTrack(id)}
          onSelectText={(id) => player.current?.selectTextTrack(id)}
        />
      ) : null}

      {panel === 'info' && channel ? (
        <View style={styles.center}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{now?.title || channel.name}</Text>
            {now?.range ? <Text style={styles.infoRange}>{now.range}</Text> : null}
            {now?.description ? (
              <Text style={styles.infoDescription} numberOfLines={8}>
                {now.description}
              </Text>
            ) : null}
            <View style={styles.infoClose}>
              <HudButton icon="close" hasTVPreferredFocus onPress={() => setPanel(null)} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const HUD_BG = 'rgba(10,10,12,0.8)';

// Medidas de _player-hud.scss a 1920×1080 (spec §4.2-4.3).
const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: '#000'},
  surface: {zIndex: 0},
  captions: {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1},
  loading: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(9,14,22,0.45)'},
  center: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, alignItems: 'center', justifyContent: 'center'},
  errorBox: {width: 420, padding: 24, borderRadius: 12, backgroundColor: 'rgba(30,30,30,0.95)', alignItems: 'center'},
  errorText: {color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 20, textAlign: 'center'},
  errorBtn: {paddingVertical: 10, paddingHorizontal: 32, borderRadius: 8},
  errorBtnText: {color: '#fff', fontSize: 18, fontWeight: '600'},
  topbar: {position: 'absolute', top: 12, left: 17.6, right: 17.6, zIndex: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  topGroup: {flexDirection: 'row', gap: 23.2},
  iconBtn: {
    width: 62.4,
    height: 62.4,
    borderRadius: 31.2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: HUD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: {width: 31.2, height: 31.2, tintColor: '#fff'},
  clock: {paddingVertical: 3.2, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: HUD_BG},
  clockText: {color: '#fff', fontSize: 31.2, fontVariant: ['tabular-nums']},
  bottombar: {
    position: 'absolute',
    left: 17.6,
    right: 17.6,
    bottom: 16,
    zIndex: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10.4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(10,10,12,0.85)',
  },
  logo: {width: 192, height: 144, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 24},
  meta: {flex: 1},
  name: {color: '#fff', fontSize: 36, fontWeight: '700'},
  lcn: {color: 'rgba(255,255,255,0.9)'},
  program: {color: 'rgba(255,255,255,0.92)', fontSize: 30.7, marginTop: 4},
  programLabel: {color: 'rgba(255,255,255,0.72)'},
  range: {color: 'rgba(255,255,255,0.88)', fontSize: 24, fontVariant: ['tabular-nums'], marginLeft: 24, alignSelf: 'flex-start', marginTop: 8},
  panelOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.35)'},
  channelPanel: {position: 'absolute', left: 0, top: 0, bottom: 0, width: 512, backgroundColor: 'rgba(10,10,12,0.9)'},
  panelTitle: {color: '#fff', fontSize: 37.6, fontWeight: '800', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10},
  panelList: {padding: 10},
  rowWrap: {marginBottom: 8},
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  rowActive: {backgroundColor: 'rgba(255,255,255,0.12)'},
  rowLogo: {width: 160, height: 72, borderRadius: 10},
  rowLcn: {color: '#fff', fontSize: 24, fontWeight: '900', minWidth: 40, textAlign: 'center'},
  rowMeta: {flex: 1},
  rowName: {color: '#fff', fontSize: 24, fontWeight: '600'},
  rowProgram: {color: 'rgba(255,255,255,0.78)', fontSize: 19.2, fontWeight: '600'},
  infoBox: {width: 900, padding: 32, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.85)'},
  infoTitle: {color: '#fff', fontSize: 36, fontWeight: '700'},
  infoRange: {color: 'rgba(255,255,255,0.85)', fontSize: 24, marginTop: 8, fontVariant: ['tabular-nums']},
  infoDescription: {color: 'rgba(255,255,255,0.9)', fontSize: 22, marginTop: 16, lineHeight: 32},
  infoClose: {alignItems: 'flex-end', marginTop: 20},
});
