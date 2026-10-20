import * as React from 'react';
import {useEffect, useState} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import {NavigationContainer, createNavigationContainerRef} from '@amazon-devices/react-navigation__native';
import {createStackNavigator} from '@amazon-devices/react-navigation__stack';
import '@appvideo/core/locales/i18n';
import {SplashScreen} from './screens/SplashScreen';
import {LoginScreen} from './screens/LoginScreen';
import {HomeScreen} from './screens/HomeScreen';
import {PlayerScreen} from './screens/PlayerScreen';
import {SmartCardScreen} from './screens/SmartCardScreen';
import {VodPlayerScreen} from './screens/VodPlayerScreen';
import {ProfilesUnavailableScreen} from './screens/ProfilesUnavailableScreen';
import {devLog} from './devLog';
import {storageReady} from './bootstrap';
import {ParentalGateHost} from './parental/ParentalGateHost';
import {useDeviceSessionLifecycle} from './deviceSessionLifecycle';
import {ErrorBoundary} from './components/ErrorBoundary';
import {InactivityHost} from './components/InactivityHost';

const Stack = createStackNavigator();

/** Para navegar fuera de una pantalla (p. ej. al login cuando revocan el dispositivo). */
const navigationRef = createNavigationContainerRef();

// Mismas opciones que vega-video-sample: sin encabezado ni animaciones.
const SCREEN_OPTIONS = {headerShown: false, animationEnabled: false, cardStyle: {backgroundColor: '#000'}};

/** Pantallas con video: mientras están arriba corre el control de inactividad. */
const PLAYER_SCREENS = new Set(['player', 'vodplayer']);

/** Pantallas raíz: al llegar se descarta el historial (Atrás no vuelve al splash). */
const ROOT_SCREENS = new Set(['login', 'smartcard', 'home', 'profiles']);

/**
 * Adapta las pantallas (que reciben `navigate(nombre, params)` y `params`)
 * a React Navigation. Atrás lo maneja el stack: desde el reproductor vuelve
 * al home, y desde una pantalla raíz cierra la app.
 */
function withNavigate(Screen) {
  return function NavigatedScreen({navigation, route}) {
    const navigate = React.useCallback(
      (name, params) => {
        devLog('navegar →', name);
        if (name === 'back') navigation.goBack();
        else if (ROOT_SCREENS.has(name)) navigation.reset({index: 0, routes: [{name, params}]});
        else navigation.navigate(name, params);
      },
      [navigation],
    );
    return React.createElement(Screen, {navigate, params: route.params});
  };
}

const Splash = withNavigate(SplashScreen);
const Login = withNavigate(LoginScreen);
const Home = withNavigate(HomeScreen);
const Player = withNavigate(PlayerScreen);
const SmartCard = withNavigate(SmartCardScreen);
const VodPlayer = withNavigate(VodPlayerScreen);
const ProfilesUnavailable = withNavigate(ProfilesUnavailableScreen);

export function App() {
  const [ready, setReady] = useState(false);
  const [navKey, setNavKey] = useState(0);
  const [routeName, setRouteName] = useState(null);
  const syncRouteName = () => setRouteName(navigationRef.getCurrentRoute()?.name ?? null);
  // Inactividad: cierra el reproductor y vuelve a la pantalla anterior.
  const stopPlayback = React.useCallback(() => {
    if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
  }, []);
  useDeviceSessionLifecycle(navigationRef, ready);

  useEffect(() => {
    storageReady.finally(() => setReady(true));
    devLog('pantalla', JSON.stringify(Dimensions.get('window')));
  }, []);

  if (!ready) return <View style={styles.root} />;

  return (
    // Reintentar rearma la navegación desde cero (key nueva → splash): volver a
    // dibujar la misma pantalla, o restaurar su estado, suele fallar igual.
    <ErrorBoundary onRetry={() => setNavKey((k) => k + 1)}>
      <NavigationContainer key={navKey} ref={navigationRef} onReady={syncRouteName} onStateChange={syncRouteName}>
        <Stack.Navigator initialRouteName="splash" screenOptions={SCREEN_OPTIONS}>
          <Stack.Screen name="splash" component={Splash} />
          <Stack.Screen name="login" component={Login} />
          <Stack.Screen name="smartcard" component={SmartCard} />
          <Stack.Screen name="home" component={Home} />
          <Stack.Screen name="player" component={Player} />
          <Stack.Screen name="vodplayer" component={VodPlayer} />
          <Stack.Screen name="profiles" component={ProfilesUnavailable} />
        </Stack.Navigator>
        <ParentalGateHost />
        <InactivityHost playbackActive={PLAYER_SCREENS.has(routeName)} onStop={stopPlayback} />
      </NavigationContainer>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
});
