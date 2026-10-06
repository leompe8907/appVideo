import * as React from 'react';
import {useEffect} from 'react';
import {ActivityIndicator, Image, Text, View} from 'react-native';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import panaccessService from '@appvideo/core/services/panaccessService';
import * as userSession from '@appvideo/core/utils/userSession';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

/**
 * Decide adónde ir al arrancar: con una sesión válida al home, si no al login.
 *
 * Es más simple que `resolveSplashDestination` de la web (perfiles, smartcard
 * y reactivación de licencia quedan para la Fase 4): acá alcanza con que el
 * middleware acepte la sesión.
 */
export function SplashScreen({navigate}) {
  const theme = getTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = 'login';
      try {
        const brand = getActiveBrandConfig();
        await panaccessService.initialize(brand);
        if (userSession.getSessionId()) {
          const valid = await panaccessService.validateSession();
          devLog('splash: sesión', valid ? 'válida' : 'inválida');
          if (valid) next = 'home';
        }
      } catch (e) {
        devLog('splash: error', e?.message);
      }
      if (!cancelled) navigate(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      {theme.logo ? (
        <Image source={theme.logo} style={styles.logo} resizeMode="contain" />
      ) : (
        <Text style={[styles.title, {color: theme.text}]}>{theme.appName}</Text>
      )}
      <ActivityIndicator size="large" color={theme.text} style={styles.spinner} />
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  logo: {width: 480, height: 110},
  title: {fontSize: 56, fontWeight: '700'},
  spinner: {marginTop: 48},
});
