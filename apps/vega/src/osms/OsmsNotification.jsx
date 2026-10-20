import * as React from 'react';
import {Modal, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {useOsmsStore} from '@appvideo/core/store/osmsStore';
import {previewText} from '@appvideo/core/utils/osmsFormat';
import {FocusButton} from '../components/FocusButton';
import {createScaledStyles} from '../scaledStyles';

/**
 * Aviso de mensaje nuevo del operador (OsmsNotificationHost de la web).
 * "Ver mensaje" abre Mi Cuenta → Mensajes en ese mensaje; Atrás o "Ahora no" lo descarta.
 */
export function OsmsNotification({visible, onView}) {
  const pending = useOsmsStore((s) => s.pendingNotification);
  const dismiss = useOsmsStore((s) => s.dismissOsmsNotification);
  if (!visible || !pending) return null;

  return (
    <Modal transparent visible onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{i18n.t('osms.notificationTitle')}</Text>
          <Text style={styles.preview}>{previewText(pending.message, 100) || i18n.t('osms.noMessage')}</Text>
          <View style={styles.actions}>
            <FocusButton
              label={i18n.t('osms.notificationView')}
              primary
              hasTVPreferredFocus
              onPress={() => {
                const id = pending.id;
                dismiss();
                onView(id);
              }}
            />
            <FocusButton label={i18n.t('osms.notificationDismiss')} onPress={dismiss} style={styles.second} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 48},
  card: {width: 720, padding: 32, borderRadius: 16, backgroundColor: 'rgba(24,24,28,0.96)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)'},
  title: {color: '#fff', fontSize: 30, fontWeight: '700', marginBottom: 12},
  preview: {color: 'rgba(255,255,255,0.85)', fontSize: 24, marginBottom: 28},
  actions: {flexDirection: 'row'},
  second: {marginLeft: 20},
});
