import * as React from 'react';
import {useState} from 'react';
import {Modal, Pressable, Text, TextInput, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getTheme} from '../theme';
import {createScaledStyles, ENTRY_SCALE} from '../scaledStyles';

const t = (key) => i18n.t(key);

function Button({label, onPress, primary}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        primary ? {backgroundColor: focused ? theme.secondary : theme.primary} : {backgroundColor: 'rgba(255,255,255,0.15)'},
        {borderColor: focused ? theme.focusColor : 'rgba(255,255,255,0.3)'},
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Pedido de PIN (ParentalPinGate de la web). En Fire TV el número se ingresa
 * con el teclado numérico del sistema (OK sobre el campo). `onSubmit(pin)`
 * devuelve true si el PIN es válido.
 */
export function PinModal({title, message, onSubmit, onCancel}) {
  const theme = getTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    const ok = await onSubmit(pin);
    if (!ok) {
      setError(t('pinGate.wrongPin'));
      setPin('');
    }
  };

  return (
    <Modal transparent visible onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title || t('pinGate.enterPin')}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            value={pin}
            onChangeText={(v) => {
              setError('');
              setPin(v.replace(/\D/g, '').slice(0, 6));
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            hasTVPreferredFocus
            placeholder={t('pinGate.maskInput')}
            placeholderTextColor="rgba(255,255,255,0.4)"
            onSubmitEditing={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused && {borderColor: theme.focusColor}]}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button label={t('pinGate.confirm')} primary onPress={submit} />
            <Button label={t('pinGate.cancel')} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles(
  {
    overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center'},
    box: {width: 440, padding: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(30,30,30,0.97)'},
    title: {color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8},
    message: {color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', marginBottom: 16},
    input: {
      color: '#fff',
      fontSize: 22,
      letterSpacing: 6,
      textAlign: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginBottom: 8,
    },
    error: {color: '#ff6b7a', fontSize: 14, textAlign: 'center', marginBottom: 8},
    actions: {flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8},
    button: {paddingVertical: 9.6, paddingHorizontal: 20, borderRadius: 8, borderWidth: 2},
    buttonText: {color: '#fff', fontSize: 15.2},
  },
  ENTRY_SCALE,
);
