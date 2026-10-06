import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {BackHandler, Dimensions, View, StyleSheet} from 'react-native';
import '@appvideo/core/locales/i18n';
import {SplashScreen} from './screens/SplashScreen';
import {LoginScreen} from './screens/LoginScreen';
import {HomeScreen} from './screens/HomeScreen';
import {PlayerScreen} from './screens/PlayerScreen';
import {devLog} from './devLog';

const SCREENS = {
  splash: SplashScreen,
  login: LoginScreen,
  home: HomeScreen,
  player: PlayerScreen,
};

/** Desde dónde vuelve "Atrás" (sin entrada: Atrás cierra la app). */
const BACK_TO = {player: 'home'};

/**
 * Navegación mínima por estado mientras no se puedan instalar los paquetes
 * de React Navigation de Amazon (Fase 2 del plan).
 */
export function App() {
  const [route, setRoute] = useState({name: 'splash', params: undefined});
  const routeRef = useRef(route);
  routeRef.current = route;

  const navigate = useCallback((name, params) => {
    devLog('navegar →', name);
    setRoute({name, params});
  }, []);

  useEffect(() => {
    devLog('pantalla', JSON.stringify(Dimensions.get('window')));
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const back = BACK_TO[routeRef.current.name];
      if (!back) return false;
      navigate(back);
      return true;
    });
    return () => sub.remove();
  }, [navigate]);

  const Screen = SCREENS[route.name];
  return (
    <View style={styles.root}>
      <Screen key={route.name} navigate={navigate} params={route.params} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
});
