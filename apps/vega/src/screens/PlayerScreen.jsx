import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View, useTVEventHandler} from 'react-native';
import {KeplerCaptionsView, KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';
import i18n from '@appvideo/core/locales/i18n';
import {VegaHlsPlayer} from '../player/VegaHlsPlayer';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';
import {rememberChannel} from '../homeMemory';

const t = (key) => i18n.t(key);
const OVERLAY_MS = 4000;
const ZAP_DELAY_MS = 600;

/**
 * Vivo a pantalla completa. Arriba/abajo cambian de canal (zapping dentro del
 * bouquet), OK muestra la información; Atrás vuelve al home (ver App.jsx).
 */
export function PlayerScreen({params}) {
  const theme = getTheme();
  const channels = params?.channels || [];
  const [index, setIndex] = useState(params?.index ?? 0);
  const [state, setState] = useState('loading');
  const [overlay, setOverlay] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const player = useRef(null);
  const handles = useRef({surface: null, caption: null});
  const overlayTimer = useRef(null);

  const channel = channels[index];

  const showOverlay = () => {
    setOverlay(true);
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setOverlay(false), OVERLAY_MS);
  };

  useTVEventHandler((evt) => {
    if (!evt) return;
    if (__DEV__) devLog('tecla', evt.eventType, evt.eventKeyAction);
    if (evt.eventKeyAction === 1) return; // 1 = soltar tecla
    const n = channels.length;
    if (!n) return;
    if (evt.eventType === 'up') setIndex((i) => (i + 1) % n);
    else if (evt.eventType === 'down') setIndex((i) => (i - 1 + n) % n);
    else if (evt.eventType === 'select' && state === 'error') setRetryToken((x) => x + 1);
    if (['up', 'down', 'select', 'left', 'right'].includes(evt.eventType)) showOverlay();
  });

  // Una instancia de reproductor por canal; el cambio espera un poco para no
  // abrir cada canal intermedio al mantener apretada la flecha.
  useEffect(() => {
    if (!channel?.url) {
      setState('error');
      return undefined;
    }
    let cancelled = false;
    rememberChannel(index);
    setState('loading');
    showOverlay();
    const timer = setTimeout(() => {
      const p = new VegaHlsPlayer({
        onState: (s, detail) => {
          if (cancelled) return;
          if (s === 'error') devLog('player: error', channel.name, detail);
          setState(s);
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
      p?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, retryToken]);

  useEffect(() => () => overlayTimer.current && clearTimeout(overlayTimer.current), []);

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
        show={false}
        style={styles.captions}
      />

      {state === 'loading' || state === 'buffering' ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.error, {color: theme.text}]}>{t('player.playbackError')}</Text>
          <Text style={[styles.hint, {color: theme.textMuted}]}>OK: {t('player.retry')}</Text>
        </View>
      ) : null}

      {overlay && channel ? (
        <View style={[styles.overlay, {backgroundColor: 'rgba(0,0,0,0.65)'}]} pointerEvents="none">
          {channel.img ? <Image source={{uri: channel.img}} style={styles.logo} resizeMode="contain" /> : null}
          <View>
            <Text style={[styles.channelName, {color: theme.text}]}>
              {channel.lcn != null ? `${channel.lcn}  ` : ''}
              {channel.name}
            </Text>
            <Text style={[styles.hint, {color: theme.textMuted}]}>▲ ▼ cambiar canal</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, backgroundColor: '#000'},
  surface: {zIndex: 0},
  captions: {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1},
  center: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2},
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 64,
    paddingVertical: 32,
  },
  logo: {width: 160, height: 90, marginRight: 32},
  channelName: {fontSize: 40, fontWeight: '700'},
  hint: {fontSize: 22, marginTop: 8},
  error: {fontSize: 34, fontWeight: '600'},
});
