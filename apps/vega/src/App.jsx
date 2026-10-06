import * as React from 'react';
import {useEffect, useState} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import {NavigationContainer} from '@amazon-devices/react-navigation__native';
import {createStackNavigator} from '@amazon-devices/react-navigation__stack';
import '@appvideo/core/locales/i18n';
import {SplashScreen} from './screens/SplashScreen';
import {LoginScreen} from './screens/LoginScreen';
import {HomeScreen} from './screens/HomeScreen';
import {PlayerScreen} from './screens/PlayerScreen';
import {SmartCardScreen} from './screens/SmartCardScreen';
import {VodPlayerScreen} from './screens/VodPlayerScreen';
import {devLog} from './devLog';
import {storageReady} from './bootstrap';
import {ParentalGateHost} from './parental/ParentalGateHost';

const Stack = createStackNavigator();

// Mismas opciones que vega-video-sample: sin encabezado ni animaciones.
const SCREEN_OPTIONS = {headerShown: false, animationEnabled: false, cardStyle: {backgroundColor: '#000'}};

/** Pantallas raíz: al llegar se descarta el historial (Atrás no vuelve al splash). */
const ROOT_SCREENS = new Set(['login', 'smartcard', 'home']);

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

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storageReady.finally(() => setReady(true));
    devLog('pantalla', JSON.stringify(Dimensions.get('window')));
  }, []);

  if (!ready) return <View style={styles.root} />;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="splash" screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="splash" component={Splash} />
        <Stack.Screen name="login" component={Login} />
        <Stack.Screen name="smartcard" component={SmartCard} />
        <Stack.Screen name="home" component={Home} />
        <Stack.Screen name="player" component={Player} />
        <Stack.Screen name="vodplayer" component={VodPlayer} />
      </Stack.Navigator>
      <ParentalGateHost />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
});
