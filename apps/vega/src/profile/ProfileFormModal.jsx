import * as React from 'react';
import {useState} from 'react';
import {Image, Modal, Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {createProfile, deleteProfile, updateProfile} from '@appvideo/core/services/externalProfilesService';
import {
  MAX_AGE_OPTIONS,
  PROFILE_AVATAR_FILES,
  buildProfilePayload,
  maxAgeAfterKidsToggle,
  maxAgeLabel,
  profileFormErrorKey,
  validateProfileForm,
} from '@appvideo/core/utils/externalProfiles';
import {ConfirmModal} from '../components/ConfirmModal';
import {FocusButton} from '../components/FocusButton';
import {FocusRing} from '../components/FocusRing';
import {FocusTextInput} from '../components/FocusTextInput';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const AVATAR_IDS = Object.keys(PROFILE_AVATAR_FILES).map(Number);

function AvatarChoice({source, selected, onPress}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.avatarCell}>
      <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <View style={[styles.avatar, selected && {borderColor: theme.focusColor}]}>
          {source ? <Image source={source} style={styles.avatarImage} resizeMode="cover" /> : null}
        </View>
        <FocusRing visible={focused} radius={12} />
      </Pressable>
    </View>
  );
}

function errorText(err, fallbackKey) {
  const key = profileFormErrorKey(err);
  return key ? t(key) : err?.message || t(fallbackKey);
}

/**
 * Crear o editar un perfil externo (ExternalProfileFormModal de la web): nombre,
 * avatar, infantil, edad máxima y PIN propio del perfil (opcional, 4 a 6
 * dígitos). Al editar un perfil con PIN, quien lo abre ya lo verificó y lo pasa
 * en `currentPin`. Atrás cancela.
 */
export function ProfileFormModal({mode, profile, currentPin, onClose, onSaved, onDeleted}) {
  const theme = getTheme();
  const isEdit = mode === 'edit';
  const [name, setName] = useState(profile?.name || '');
  const [avatarId, setAvatarId] = useState(profile?.avatarId ?? AVATAR_IDS[0]);
  const [isKids, setIsKids] = useState(profile?.isKids === true);
  const [maxAge, setMaxAge] = useState(profile ? (profile.maxAge ?? null) : null);
  const [newPin, setNewPin] = useState('');
  const [removePin, setRemovePin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (submitting) return;
    const invalid = validateProfileForm({name, newPin});
    if (invalid) {
      setError(t(invalid));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildProfilePayload({mode, name, avatarId, isKids, maxAge, newPin, removePin});
      if (isEdit) await updateProfile(profile.id, payload, currentPin);
      else await createProfile(payload);
      onSaved();
    } catch (err) {
      setError(errorText(err, isEdit ? 'profile.editError' : 'profile.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setSubmitting(true);
    setError(null);
    try {
      await deleteProfile(profile.id, currentPin);
      onDeleted();
    } catch (err) {
      setError(errorText(err, 'profile.deleteError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, {backgroundColor: theme.surface}]}>
          <Text style={styles.title}>{isEdit ? t('profile.editTitle') : t('profile.createTitle')}</Text>
          <ScrollView style={styles.body}>
            <Text style={styles.label}>{t('profile.createName')}</Text>
            <FocusTextInput
              value={name}
              onChangeText={setName}
              placeholder={t('profile.createNamePlaceholder')}
              maxLength={50}
              editable={!submitting}
              hasTVPreferredFocus
            />

            <Text style={styles.label}>{t('profile.createAvatar')}</Text>
            <View style={styles.avatars}>
              {AVATAR_IDS.map((id) => (
                <AvatarChoice key={id} source={theme.assets.avatars?.[id]} selected={avatarId === id} onPress={() => setAvatarId(id)} />
              ))}
            </View>

            <FocusButton
              label={`${t('profile.kidsLabel')}: ${isKids ? t('common.yes') : t('common.no')}`}
              primary={isKids}
              disabled={submitting}
              onPress={() => {
                const next = !isKids;
                setIsKids(next);
                setMaxAge(maxAgeAfterKidsToggle(next, maxAge));
              }}
              style={styles.toggle}
            />

            <Text style={styles.label}>{t('profile.maxAgeLabel')}</Text>
            <View style={styles.chips}>
              {MAX_AGE_OPTIONS.map((value) => (
                <FocusButton
                  key={String(value)}
                  label={maxAgeLabel(t, value)}
                  primary={maxAge === value}
                  disabled={submitting}
                  onPress={() => setMaxAge(value)}
                  style={styles.chip}
                />
              ))}
            </View>

            <Text style={styles.label}>{isEdit && profile?.hasPin ? t('profile.changePin') : t('profile.createPin')}</Text>
            <FocusTextInput
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('profile.pinPlaceholder')}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              editable={!submitting && !removePin}
            />
            {isEdit && profile?.hasPin ? (
              <FocusButton
                label={t('profile.removePin')}
                primary={removePin}
                disabled={submitting}
                onPress={() => setRemovePin((v) => !v)}
                style={styles.toggle}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <FocusButton
              label={
                submitting
                  ? t(isEdit ? 'profile.editSubmitting' : 'profile.createSubmitting')
                  : t(isEdit ? 'profile.editSubmit' : 'profile.createSubmit')
              }
              primary
              disabled={submitting}
              onPress={save}
            />
            {isEdit && !profile?.isOwner ? (
              <FocusButton label={t('profile.deleteConfirm')} disabled={submitting} onPress={() => setConfirmDelete(true)} style={styles.gap} />
            ) : null}
            <FocusButton label={t('profile.editCancel')} disabled={submitting} onPress={onClose} style={styles.gap} />
          </View>
        </View>
      </View>
      {confirmDelete ? (
        <ConfirmModal
          title={t('profile.deleteTitle')}
          message={t('profile.deleteMessage', {name: profile?.name || ''})}
          confirmLabel={t('profile.deleteConfirm')}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center'},
  box: {width: 1280, maxHeight: 1000, padding: 40, borderRadius: 20},
  title: {color: '#fff', fontSize: 40, fontWeight: '700', marginBottom: 16},
  body: {flexGrow: 0},
  label: {color: 'rgba(255,255,255,0.8)', fontSize: 22, marginTop: 20, marginBottom: 10},
  avatars: {flexDirection: 'row', flexWrap: 'wrap'},
  avatarCell: {marginRight: 16, marginBottom: 16},
  avatar: {width: 104, height: 104, borderRadius: 12, overflow: 'hidden', borderWidth: 4, borderColor: 'transparent'},
  avatarImage: {width: 96, height: 96},
  toggle: {alignSelf: 'flex-start', marginTop: 16, paddingVertical: 12},
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {marginRight: 12, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 24},
  error: {color: '#ff8080', fontSize: 22, marginTop: 16},
  actions: {flexDirection: 'row', marginTop: 24},
  gap: {marginLeft: 20},
});
