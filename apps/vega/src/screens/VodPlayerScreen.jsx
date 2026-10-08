import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, BackHandler, Image, Pressable, Text, View, useTVEventHandler} from 'react-native';
import LinearGradient from '@amazon-devices/react-linear-gradient';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import panaccessService from '@appvideo/core/services/panaccessService';
import {VegaHlsPlayer} from '../player/VegaHlsPlayer';
import {VideoSurface} from '../player/VideoSurface';
import {StatsPanel, getStatsVisible, setStatsVisible} from '../player/StatsPanel';
import {TracksPanel, hasTrackOptions} from '../player/TracksPanel';
import {Clock} from '../components/Clock';
import {FocusRing} from '../components/FocusRing';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key) => i18n.t(key);
const SKIP_SECONDS = 10;

const ICONS = {
  back: require('../../assets/icons/app-back.png'),
  rewind: require('../../assets/icons/app-rewind.png'),
  forward: require('../../assets/icons/app-forward.png'),
  play: require('../../assets/icons/app-play.png'),
  pause: require('../../assets/icons/app-pause.png'),
  subtitles: require('../../assets/icons/app-subtitles.png'),
  stats: require('../../assets/icons/nav-settings.png'),
};

function hms(total) {
  const s = Math.max(0, Math.floor(total || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => (n < 10 ? `0${n}` : String(n));
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function HudButton({icon, onPress, primary, hasTVPreferredFocus, onFocus}) {
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
        style={[styles.iconBtn, primary && styles.iconBtnPrimary]}>
        <Image source={ICONS[icon]} style={styles.iconImg} />
      </Pressable>
      <FocusRing visible={focused} radius={999} />
    </View>
  );
}

/**
 * Reproductor de VOD y catchup con el HUD de appVideo (spec §4.2, spec 2 §3,
 * spec 3 §3.4): URL de `getVodM3u8Url({vodId})` o la de catchup ya armada, botones Volver / −10 s / Play-Pausa / +10 s,
 * barra de progreso con tiempos y "−restante"; siempre arranca en 0 (como la web).
 */
export function VodPlayerScreen({params, navigate}) {
  const theme = getTheme();
  const hideMs = Math.max(500, Number(getActiveBrandConfig()?.player?.hudAutoHideMs) || 6000);
  const [state, setState] = useState('loading');
  const [hudVisible, setHudVisible] = useState(true);
  const [pos, setPos] = useState({current: 0, duration: 0, paused: false});
  const player = useRef(null);
  const handles = useRef({surface: null, caption: null});
  const hideTimer = useRef(null);

  const showHud = useCallback(() => {
    setHudVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHudVisible(false), hideMs);
  }, [hideMs]);

  useEffect(() => {
    const timer = setInterval(() => {
      const pl = player.current;
      if (pl) setPos({current: pl.currentTime || 0, duration: pl.duration || 0, paused: pl.paused});
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const [panel, setPanel] = useState(null); // null | 'tracks'
  const [tracks, setTracks] = useState(null);
  const [statsOn, setStatsOn] = useState(getStatsVisible);
  const toggleStats = () => {
    setStatsVisible(!statsOn);
    setStatsOn(!statsOn);
  };

  // Atrás cierra el panel de pistas; sin panel, el stack vuelve al detalle.
  useEffect(() => {
    if (!panel) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPanel(null);
      return true;
    });
    return () => sub.remove();
  }, [panel]);

  useEffect(() => {
    if (panel || state !== 'playing') {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setHudVisible(true);
    } else {
      showHud();
    }
  }, [panel, state, showHud]);

  useEffect(() => () => hideTimer.current && clearTimeout(hideTimer.current), []);

  useTVEventHandler((evt) => {
    if (!evt) return;
    if (__DEV__) devLog('vod tecla', evt.eventType, evt.eventKeyAction);
    if (evt.eventKeyAction === 1) return;
    const p = player.current;
    switch (evt.eventType) {
      case 'playPause':
        if (p) (p.paused ? p.play() : p.pause());
        showHud();
        break;
      case 'fastForward':
        p?.seekTo(p.currentTime + SKIP_SECONDS);
        showHud();
        break;
      case 'rewind':
        p?.seekTo(p.currentTime - SKIP_SECONDS);
        showHud();
        break;
      case 'up':
      case 'down':
      case 'left':
      case 'right':
      case 'select':
        showHud();
        break;
      default:
    }
  });

  useEffect(() => {
    let url;
    try {
      // Catchup llega con la URL ya armada (getCatchupM3u8Url); VOD con vodId.
      url = params?.url ? panaccessService.normalizePlaybackUrl(params.url) : panaccessService.getVodM3u8Url({vodId: params?.vodId});
    } catch (e) {
      devLog('vod: url', e?.message);
      setState('error');
      return undefined;
    }
    let cancelled = false;
    const p = new VegaHlsPlayer({
      onState: (s, detail) => {
        if (cancelled) return;
        if (s === 'error') devLog('vod: error', params?.vodId, detail);
        setState(s);
      },
      onTracks: (next) => {
        if (!cancelled) setTracks(next);
      },
    });
    player.current = p;
    if (handles.current.surface) p.setSurfaceHandle(handles.current.surface);
    if (handles.current.caption) p.setCaptionViewHandle(handles.current.caption);
    devLog('vod: cargando', params?.vodId, params?.title);
    p.load(url).catch((e) => {
      devLog('vod: load', e?.message);
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
      player.current = null;
      p.destroy();
    };
  }, [params?.vodId, params?.url, params?.title]);

  const {current, duration, paused} = pos;
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <View style={styles.container}>
      <VideoSurface handlesRef={handles} playerRef={player} showCaptions={Boolean(tracks?.textEnabled)} />
      {statsOn ? <StatsPanel playerRef={player} /> : null}

      {state === 'loading' || state === 'buffering' ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.center}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('vod.errorPlay')}</Text>
            <Pressable hasTVPreferredFocus onPress={() => navigate('back')} style={[styles.errorBtn, {backgroundColor: theme.primary}]}>
              <Text style={styles.errorBtnText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {hudVisible ? (
        <>
          <View style={styles.topbar}>
            <View style={styles.centerGroup}>
              <HudButton icon="back" onPress={() => navigate('back')} onFocus={showHud} />
              {hasTrackOptions(tracks) ? <HudButton icon="subtitles" onPress={() => setPanel('tracks')} onFocus={showHud} /> : null}
              <HudButton icon="stats" onPress={toggleStats} onFocus={showHud} />
            </View>
            <View style={styles.centerGroup}>
              <HudButton icon="rewind" onPress={() => player.current?.seekTo(current - SKIP_SECONDS)} onFocus={showHud} />
              <HudButton
                icon={paused ? 'play' : 'pause'}
                primary
                hasTVPreferredFocus={!panel && state !== 'error'}
                onPress={() => (paused ? player.current?.play() : player.current?.pause())}
                onFocus={showHud}
              />
              <HudButton icon="forward" onPress={() => player.current?.seekTo(current + SKIP_SECONDS)} onFocus={showHud} />
            </View>
            <View style={styles.clock}>
              <Clock style={styles.clockText} />
            </View>
          </View>
          <View style={styles.bottom} pointerEvents="none">
            {params?.title ? (
              <Text style={styles.title} numberOfLines={1}>
                {params.title}
              </Text>
            ) : null}
            <View style={styles.seek}>
              <Text style={styles.time}>{hms(current)}</Text>
              <View style={styles.track}>
                <LinearGradient colors={['#4ed3ff', '#8efeb3']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={[styles.fill, {width: `${Math.round(progress * 100)}%`}]} />
              </View>
              <Text style={styles.time}>{hms(duration)}</Text>
              {duration > 0 ? <Text style={styles.remaining}>{`−${hms(duration - current)}`}</Text> : null}
            </View>
          </View>
        </>
      ) : null}

      {panel === 'tracks' ? (
        <TracksPanel
          tracks={tracks}
          onSelectAudio={(id) => player.current?.selectAudioTrack(id)}
          onSelectText={(id) => player.current?.selectTextTrack(id)}
        />
      ) : null}
    </View>
  );
}

const HUD_BG = 'rgba(10,10,12,0.8)';

// _player-hud.scss a 1920×1080 (spec §4.2).
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
  centerGroup: {flexDirection: 'row', gap: 23.2},
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
  iconBtnPrimary: {backgroundColor: 'rgba(255,255,255,0.18)'},
  iconImg: {width: 31.2, height: 31.2, tintColor: '#fff'},
  clock: {paddingVertical: 3.2, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: HUD_BG},
  clockText: {color: '#fff', fontSize: 31.2, fontVariant: ['tabular-nums']},
  bottom: {position: 'absolute', left: 17.6, right: 17.6, bottom: 16, zIndex: 14},
  title: {color: '#fff', fontSize: 36, fontWeight: '700', marginBottom: 10},
  seek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  time: {color: '#fff', fontSize: 20.8, fontVariant: ['tabular-nums']},
  track: {flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
  remaining: {color: '#9fe8ff', fontSize: 20.8, fontVariant: ['tabular-nums']},
});
