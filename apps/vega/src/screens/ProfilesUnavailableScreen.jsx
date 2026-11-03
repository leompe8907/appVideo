import * as React from 'react';
import {BackHandler, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {clearSessionBeforeNewLogin} from '@appvideo/core/services/loginFlow';
import {FocusButton} from '../components/FocusButton';
import {resetHomeMemory} from '../homeMemory';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

/**
 * Destino de `/profile` mientras Vega no tenga pantalla de perfiles (tarea 34).
 * Con perfiles externos (wind) la licencia la elige el perfil, así que no se
 * puede seguir al home: se ofrece cerrar sesión o salir.
 */
export function ProfilesUnavailableScreen({navigate}) {
  const theme = getTheme();
  const logout = () => {
    clearSessionBeforeNewLogin();
    resetHomeMemory();
    navigate('login');
  };
  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <Text style={[styles.title, {color: theme.text}]}>{i18n.t('profile.unavailableTitle')}</Text>
      <Text style={[styles.message, {color: theme.text}]}>{i18n.t('profile.unavailableMessage')}</Text>
      <View style={styles.actions}>
        <FocusButton label={i18n.t('common.logout')} onPress={logout} hasTVPreferredFocus primary />
        <FocusButton label={i18n.t('common.exit')} onPress={() => BackHandler.exitApp()} style={styles.secondButton} />
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 160},
  title: {fontSize: 40, fontWeight: '700', marginBottom: 20, textAlign: 'center'},
  message: {fontSize: 26, opacity: 0.85, marginBottom: 48, textAlign: 'center'},
  actions: {flexDirection: 'row'},
  secondButton: {marginLeft: 24},
});
