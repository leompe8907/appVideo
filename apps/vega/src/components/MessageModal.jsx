import * as React from 'react';
import {useState} from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {FocusRing} from './FocusRing';
import {createScaledStyles, ENTRY_SCALE} from '../scaledStyles';

/** Mensaje modal con un botón "Cerrar" (como MessageModal de la web). Atrás también cierra. */
export function MessageModal({message, type = 'error', onClose}) {
  const [focused, setFocused] = useState(false);
  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, type === 'error' && styles.boxError]}>
          <Text style={styles.message}>{message}</Text>
          <View>
            <Pressable
              hasTVPreferredFocus
              onPress={onClose}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={styles.button}>
              <Text style={styles.buttonText}>{i18n.t('common.close')}</Text>
            </Pressable>
            <FocusRing visible={focused} radius={999} scale={ENTRY_SCALE} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center'},
  box: {
    width: 448,
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(42,42,42,0.95)',
  },
  boxError: {borderColor: 'rgba(220,53,69,0.4)'},
  message: {color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 20},
  button: {alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 32, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)'},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
}, ENTRY_SCALE);
