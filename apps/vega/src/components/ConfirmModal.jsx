import * as React from 'react';
import {useState} from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getTheme} from '../theme';
import {createScaledStyles, ENTRY_SCALE} from '../scaledStyles';

function Button({label, onPress, primary, hasTVPreferredFocus}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        primary
          ? {backgroundColor: focused ? theme.secondary : theme.primary, borderColor: focused ? theme.secondary : theme.primary}
          : {backgroundColor: 'rgba(255,255,255,0.15)', borderColor: focused ? theme.focusColor : 'rgba(255,255,255,0.3)'},
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** Confirmación (ConfirmModal de la web): foco inicial en Cancelar; Atrás cancela. */
export function ConfirmModal({title, message, confirmLabel, onConfirm, onCancel}) {
  return (
    <Modal transparent visible onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button label={confirmLabel || i18n.t('settings.confirm')} primary onPress={onConfirm} />
            <Button label={i18n.t('settings.cancel')} hasTVPreferredFocus onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// _confirm-modal.scss (spec 2 §5.3), agrandado como el login.
const styles = createScaledStyles(
  {
    overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16},
    box: {width: 520, padding: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(42,42,42,0.95)'},
    title: {color: '#fff', fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 8},
    message: {color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '300', textAlign: 'center', marginBottom: 16},
    actions: {flexDirection: 'row', justifyContent: 'center', gap: 12},
    button: {paddingVertical: 9.6, paddingHorizontal: 20, borderRadius: 8, borderWidth: 2},
    buttonText: {color: '#fff', fontSize: 15.2},
  },
  ENTRY_SCALE,
);
