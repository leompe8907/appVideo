import * as React from 'react';
import {useEffect, useState} from 'react';
import {Animated, Easing, Text, View} from 'react-native';
import LinearGradient from '@amazon-devices/react-linear-gradient';
import i18n from '@appvideo/core/locales/i18n';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {FullScreenImage} from '../components/FullScreenImage';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const TIPS_INTERVAL_MS = 4000;
const TIPS = ['preload.tip1', 'preload.tip2', 'preload.tip3', 'preload.tip4'];

function useLoop(duration, toValue = 1) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(value, {toValue, duration, easing: Easing.linear, useNativeDriver: true}));
    anim.start();
    return () => anim.stop();
  }, [value, duration, toValue]);
  return value;
}

/**
 * Precarga (PreloadScreen de la web, _preload.scss): pantalla completa sin
 * menú lateral, con fondo al 30 %, logo que late, spinner de dos colores,
 * barra de progreso con porcentaje, mensaje y consejos rotativos.
 */
export function PreloadScreen() {
  const theme = getTheme();
  const epg = usePreloadStore((s) => s.epg);
  const vodStatus = usePreloadStore((s) => s.vod?.status);
  const progress = epg.progress || {};
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), TIPS_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const spin = useLoop(1000);
  const spinOuter = useLoop(1500);
  const pulse = useLoop(2000);
  const rotate = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});
  const rotateOuter = spinOuter.interpolate({inputRange: [0, 1], outputRange: ['360deg', '0deg']});
  const logoOpacity = pulse.interpolate({inputRange: [0, 0.5, 1], outputRange: [1, 0.8, 1]});
  const logoScale = pulse.interpolate({inputRange: [0, 0.5, 1], outputRange: [1, 0.98, 1]});

  const message = epg.status === 'error' || vodStatus === 'error' ? t('preload.error') : t('preload.message');
  const submessage =
    epg.status === 'loading' && progress.total > 0
      ? t('preload.channelsProgress', {current: progress.current ?? 0, total: progress.total})
      : epg.status === 'ready' || epg.status === 'finishing' || vodStatus === 'ready'
        ? t('preload.finishing')
        : '';

  return (
    <View style={styles.root}>
      <View style={styles.background}>
        <FullScreenImage source={theme.assets.background} />
      </View>
      <View style={styles.content}>
        <Animated.Image
          source={theme.logo}
          resizeMode="contain"
          style={[styles.logo, {opacity: logoOpacity, transform: [{scale: logoScale}]}]}
        />
        <View style={styles.spinner}>
          <Animated.View style={[styles.spinnerOuter, {transform: [{rotate: rotateOuter}]}]} />
          <Animated.View style={[styles.spinnerInner, {transform: [{rotate}]}]} />
        </View>
        <View style={styles.progress}>
          <View style={styles.track}>
            <LinearGradient
              colors={['#3498db', '#2ecc71']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={[styles.fill, {width: `${percent}%`}]}
            />
          </View>
          <Text style={styles.percent}>{`${Math.round(percent)}%`}</Text>
        </View>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.submessage}>{submessage}</Text>
        <Text style={styles.tip}>{t(TIPS[tipIndex])}</Text>
      </View>
    </View>
  );
}

// _preload.scss a 1920×1080 (1em = 16px).
const styles = createScaledStyles({
  root: {flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center'},
  background: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3},
  content: {alignItems: 'center', justifyContent: 'center'},
  logo: {width: 300, height: 150, marginBottom: 48},
  spinner: {width: 80, height: 80, marginBottom: 32, alignItems: 'center', justifyContent: 'center'},
  spinnerOuter: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#3498db',
    opacity: 0.5,
  },
  spinnerInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: '#3498db',
    borderRightColor: '#2ecc71',
  },
  progress: {width: 400, marginVertical: 32, alignItems: 'center'},
  track: {width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 3},
  percent: {color: '#fff', fontSize: 14.4, marginTop: 8, opacity: 0.8},
  message: {color: '#fff', fontSize: 24, fontWeight: '300', letterSpacing: 2, textAlign: 'center'},
  submessage: {color: 'rgba(255,255,255,0.7)', fontSize: 21.6, marginTop: 10.8, minHeight: 32.4, textAlign: 'center'},
  tip: {maxWidth: 500, marginTop: 48, color: 'rgba(255,255,255,0.6)', fontSize: 24, lineHeight: 38.4, textAlign: 'center'},
});
