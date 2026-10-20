import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {BackHandler, Dimensions, Modal, Text, View, useTVEventHandler} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useInactivityStore} from '@appvideo/core/store/inactivityStore';
import * as userSession from '@appvideo/core/utils/userSession';
import {
  formatInactivityCountdown,
  resolveInactivityGraceSec,
  resolveInactivityPhase,
  resolveInactivityTimeoutSec,
} from '@appvideo/core/utils/inactivityConfig';
import {FocusButton} from './FocusButton';
import {FullScreenImage} from './FullScreenImage';
import {RemoteImage} from './RemoteImage';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const MAX_SCREENSAVER_IMAGES = 12;

// Como FullScreenImage: en Vega la imagen absoluta necesita ancho y alto explícitos.
function fullScreen() {
  const {width, height} = Dimensions.get('window');
  return {position: 'absolute', top: 0, left: 0, width, height};
}

function screensaverUris(vod) {
  const pick = (it) => it?.backgroundImageURL || it?.posterInfoURL || it?.posterListURL || it?.imageUrl || it?.posterUrl || null;
  const uris = [...(vod?.vodRecommended || []), ...(vod?.allVods || []).slice(0, 40)].map(pick).filter(Boolean);
  return [...new Set(uris)].slice(0, MAX_SCREENSAVER_IMAGES);
}

/**
 * "¿Sigues ahí?" y salvapantallas (InactivityHost de la web). Mientras se
 * reproduce, si no se toca el control durante X_INACTIVITY_TIMEOUT_SEC (del
 * cliente, o el default de la marca) aparece el aviso con cuenta regresiva; al
 * terminar se cierra el reproductor (`onStop`) y se muestra el salvapantallas
 * hasta la próxima tecla.
 */
export function InactivityHost({playbackActive, onStop}) {
  const theme = getTheme();
  const vod = usePreloadStore((s) => s.vod);
  const lastInteractionAtMs = useInactivityStore((s) => s.lastInteractionAtMs);
  const touch = useInactivityStore((s) => s.touch);
  const [phase, setPhase] = useState({phase: 'active', secondsLeft: 0});
  const [screensaver, setScreensaver] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const brand = getActiveBrandConfig();
  const {timeoutSec, graceSec} = useMemo(() => {
    const cfg = userSession.getClientConfig(brand);
    return {timeoutSec: resolveInactivityTimeoutSec(cfg, brand), graceSec: resolveInactivityGraceSec(cfg, brand)};
    // Se recalcula al empezar cada reproducción (el clientConfig puede llegar después del login).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackActive]);

  // Cualquier tecla cuenta como actividad y despierta el salvapantallas.
  useTVEventHandler((evt) => {
    if (!evt || evt.eventKeyAction !== 0) return;
    touch(Date.now());
    if (screensaver) setScreensaver(false);
  });

  // Un tic por segundo, sólo mientras se reproduce.
  useEffect(() => {
    if (!playbackActive || screensaver || timeoutSec <= 0) {
      setPhase({phase: 'active', secondsLeft: graceSec});
      return undefined;
    }
    const tick = () =>
      setPhase(resolveInactivityPhase({nowMs: Date.now(), lastInteractionAtMs, timeoutSec, graceSec}));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [playbackActive, screensaver, timeoutSec, graceSec, lastInteractionAtMs]);

  useEffect(() => {
    if (phase.phase !== 'expired') return;
    devLog('inactividad: se detiene la reproducción');
    onStop?.();
    setImageIndex(0);
    setScreensaver(true);
  }, [phase.phase, onStop]);

  const uris = useMemo(() => (screensaver ? screensaverUris(vod) : []), [screensaver, vod]);
  useEffect(() => {
    if (!screensaver || uris.length < 2) return undefined;
    const rotateMs = Math.min(20000, Math.max(4000, Number(brand?.player?.screensaverRotateMs) || 9000));
    const id = setInterval(() => setImageIndex((i) => (i + 1) % uris.length), rotateMs);
    return () => clearInterval(id);
  }, [screensaver, uris.length, brand?.player?.screensaverRotateMs]);

  // Atrás: cierra el aviso o despierta el salvapantallas.
  const warning = phase.phase === 'warning';
  useEffect(() => {
    if (!warning && !screensaver) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      touch(Date.now());
      setScreensaver(false);
      return true;
    });
    return () => sub.remove();
  }, [warning, screensaver, touch]);

  if (screensaver) {
    return (
      <Modal transparent visible onRequestClose={() => setScreensaver(false)}>
        <View style={styles.screensaver}>
          {uris.length ? (
            <RemoteImage uri={uris[imageIndex]} fallback={theme.assets.background} style={fullScreen()} resizeMode="cover" />
          ) : (
            <FullScreenImage source={theme.assets.background} />
          )}
          <View style={styles.dim} />
          <Text style={styles.hint}>{i18n.t('inactivity.wakeHint')}</Text>
        </View>
      </Modal>
    );
  }

  if (!warning) return null;
  return (
    <Modal transparent visible onRequestClose={() => touch(Date.now())}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{i18n.t('inactivity.title')}</Text>
          <Text style={styles.message}>
            {i18n.t('inactivity.message', {time: formatInactivityCountdown(phase.secondsLeft)})}
          </Text>
          <FocusButton label={i18n.t('inactivity.continue')} onPress={() => touch(Date.now())} hasTVPreferredFocus primary />
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center'},
  card: {width: 760, padding: 40, borderRadius: 16, backgroundColor: 'rgba(30,30,30,0.96)', alignItems: 'center'},
  title: {color: '#fff', fontSize: 40, fontWeight: '700', marginBottom: 16},
  message: {color: 'rgba(255,255,255,0.85)', fontSize: 26, textAlign: 'center', marginBottom: 36},
  screensaver: {flex: 1, backgroundColor: '#000', justifyContent: 'flex-end'},
  dim: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)'},
  hint: {color: '#fff', fontSize: 26, textAlign: 'center', marginBottom: 60},
});
