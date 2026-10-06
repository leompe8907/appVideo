import * as React from 'react';
import {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {resolveSplashDestination} from '@appvideo/core/services/splashAuthFlow';
import {FullScreenImage} from '../components/FullScreenImage';
import {getTheme} from '../theme';
import {screenForWebRoute} from '../routes';
import {devLog} from '../devLog';

const AUTH_TIMEOUT_MS = 60000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Igual que SplashPage de la web (spec §5.1): `splash.png` de la marca a
 * pantalla completa durante al menos `ui.splashDuration`, mientras
 * `resolveSplashDestination` decide el destino (sesión + licencia → home o
 * smartcard; si no → login).
 */
export function SplashScreen({navigate}) {
  const theme = getTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const started = Date.now();
      let route = '/login';
      try {
        route = await Promise.race([
          resolveSplashDestination(getActiveBrandConfig()),
          wait(AUTH_TIMEOUT_MS).then(() => '/login'),
        ]);
      } catch (e) {
        devLog('splash: error', e?.message);
      }
      const remaining = theme.splashDurationMs - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      devLog('splash: destino', route);
      if (!cancelled) navigate(screenForWebRoute(route));
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, theme.splashDurationMs]);

  return (
    <View style={styles.container}>
      <FullScreenImage source={theme.assets.splash} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000'},
});
