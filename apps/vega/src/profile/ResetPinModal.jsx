import * as React from 'react';
import {useState} from 'react';
import {Modal, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {resetProfilePin} from '@appvideo/core/services/externalProfilesService';
import {validateProfileForm} from '@appvideo/core/utils/externalProfiles';
import {FocusButton} from '../components/FocusButton';
import {FocusTextInput} from '../components/FocusTextInput';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);

/** "Olvidé el PIN" (ResetPinModal de la web): con la contraseña de la cuenta se quita el PIN o se pone uno nuevo. */
export function ResetPinModal({profile, onClose, onDone}) {
  const theme = getTheme();
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!password || submitting) return;
    // Sólo valida el formato del PIN (el nombre no aplica acá).
    const invalid = validateProfileForm({name: profile.name || '-', newPin});
    if (invalid) {
      setError(t(invalid));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetProfilePin(profile.id, password, newPin || undefined);
      onDone();
    } catch (err) {
      setError(err?.code === 'current_password_incorrect' ? t('profile.wrongPassword') : err?.message || t('profile.editError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, {backgroundColor: theme.surface}]}>
          <Text style={styles.title}>{`${t('profile.forgotPin')}: ${profile.name}`}</Text>
          <Text style={styles.label}>{t('profile.accountPassword')}</Text>
          <FocusTextInput value={password} onChangeText={setPassword} secureTextEntry editable={!submitting} hasTVPreferredFocus />
          <Text style={styles.label}>{t('profile.newPinOptional')}</Text>
          <FocusTextInput
            value={newPin}
            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            editable={!submitting}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <FocusButton label={t('profile.editSubmit')} primary disabled={submitting || !password} onPress={submit} />
            <FocusButton label={t('profile.editCancel')} disabled={submitting} onPress={onClose} style={styles.gap} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center'},
  box: {width: 900, padding: 40, borderRadius: 20},
  title: {color: '#fff', fontSize: 36, fontWeight: '700', marginBottom: 12},
  label: {color: 'rgba(255,255,255,0.8)', fontSize: 22, marginTop: 20, marginBottom: 10},
  error: {color: '#ff8080', fontSize: 22, marginTop: 16},
  actions: {flexDirection: 'row', marginTop: 28},
  gap: {marginLeft: 20},
});
