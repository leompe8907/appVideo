import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import panaccessService from '@appvideo/core/services/panaccessService';
import {waitForDeviceSessionAuth} from '@appvideo/core/services/loginFlow';
import {isProfilesDisabledError, listProfiles} from '@appvideo/core/services/externalProfilesService';
import {enterProfile, forgetActiveProfile, takeOverProfileLicense} from '@appvideo/core/services/externalProfileSession';
import {useActiveProfileStore} from '@appvideo/core/store/activeProfileStore';
import {getActiveLicense, setLoggedOut} from '@appvideo/core/utils/userSession';
import {
  maxAgeLabel,
  nextStepAfterEnter,
  pickAutoEnterProfile,
  profileErrorMessageKey,
  routeWithoutProfiles,
} from '@appvideo/core/utils/externalProfiles';
import {ConfirmModal} from '../components/ConfirmModal';
import {FocusButton} from '../components/FocusButton';
import {FocusRing} from '../components/FocusRing';
import {FullScreenImage} from '../components/FullScreenImage';
import {MessageModal} from '../components/MessageModal';
import {PinModal} from '../parental/PinModal';
import {resetHomeMemory} from '../homeMemory';
import {screenForWebRoute} from '../routes';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key, opts) => i18n.t(key, opts);
const toScreen = (route) => screenForWebRoute(route);

function ProfileCard({profile, avatar, busy, disabled, hasTVPreferredFocus, onPress}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  const badge = [profile.isKids ? t('profile.kidsBadge') : null, profile.maxAge != null ? maxAgeLabel(t, profile.maxAge) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.card}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={t('profile.profileAria', {name: profile.name})}>
        <View style={[styles.avatar, {backgroundColor: theme.surface}]}>
          {avatar ? (
            <Image source={avatar} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarLetter}>{String(profile.name || '?').charAt(0).toUpperCase()}</Text>
          )}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : null}
        </View>
        <FocusRing visible={focused} radius={16} />
      </Pressable>
      <Text style={[styles.name, focused && styles.nameFocused]} numberOfLines={1}>
        {profile.name}
      </Text>
      {profile.hasPin ? <Text style={styles.meta}>{`🔒 ${t('profile.hasPin')}`}</Text> : null}
      {badge ? <Text style={styles.meta}>{badge}</Text> : null}
    </View>
  );
}

/**
 * "¿Quién está viendo?" con perfiles externos (ExternalProfilePage de la web,
 * `features.profilesSource: 'externo'`): la licencia la elige el perfil.
 * - Entra solo al último perfil (o al único) si no tiene PIN.
 * - Perfil con PIN: lo pide (lo verifica el backend).
 * - Si todas las licencias del perfil están en uso: "Continuar aquí".
 * - Sin perfiles en el backend o sin sesión con él: sigue como antes.
 * Crear, editar y borrar perfiles queda para otra tarea.
 */
export function ProfileScreen({navigate}) {
  const theme = getTheme();
  const brand = getActiveBrandConfig();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const [pinFor, setPinFor] = useState(null);
  const [inUse, setInUse] = useState(null);
  const autoEnterTried = useRef(false);

  const leaveWithoutProfiles = useCallback(() => {
    forgetActiveProfile();
    navigate(toScreen(routeWithoutProfiles(Boolean(getActiveLicense()?.licenseKey))));
  }, [navigate]);

  const enter = useCallback(
    async (profile, pin) => {
      setBusyId(profile.id);
      try {
        const step = nextStepAfterEnter(await enterProfile(brand, profile, {pin}));
        if (step.inUse) {
          setInUse(step.inUse);
          return;
        }
        if (step.keepProfileWithoutLicense) {
          // Cuenta sin licencias sincronizadas todavía: elegir tarjeta como siempre.
          useActiveProfileStore.getState().setActiveProfile({
            id: profile.id,
            name: profile.name,
            imageId: profile.avatarId,
            source: 'externo',
            maxAge: profile.maxAge,
            isKids: profile.isKids,
            hasPin: profile.hasPin,
          });
        }
        resetHomeMemory();
        navigate(toScreen(step.route));
      } finally {
        setBusyId(null);
      }
    },
    [brand, navigate],
  );

  const showError = (err) => {
    devLog('perfiles: error', err?.code || err?.message);
    const key = profileErrorMessageKey(err);
    setMessage(key === 'profile.pinLocked' ? t(key) : err?.message || t(key));
  };

  const select = async (profile) => {
    if (busyId != null) return;
    if (profile.hasPin) {
      setPinFor(profile);
      return;
    }
    try {
      await enter(profile);
    } catch (err) {
      showError(err);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!(await waitForDeviceSessionAuth())) {
        devLog('perfiles: sin sesión con el backend, se sigue sin perfiles');
        leaveWithoutProfiles();
        return;
      }
      const data = await listProfiles();
      setProfiles(data.profiles);
      if (!autoEnterTried.current) {
        autoEnterTried.current = true;
        const target = pickAutoEnterProfile(data.profiles, useActiveProfileStore.getState().id);
        if (target) {
          try {
            await enter(target);
          } catch (err) {
            showError(err);
          }
        }
      }
    } catch (err) {
      if (isProfilesDisabledError(err)) {
        leaveWithoutProfiles();
        return;
      }
      devLog('perfiles: no se pudieron cargar', err?.message);
      setLoadError(err?.message || t('profile.errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [enter, leaveWithoutProfiles]);

  useEffect(() => {
    load();
    // Sólo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPin = async (pin) => {
    const profile = pinFor;
    if (!profile) return true;
    try {
      // El modal sigue abierto mientras se prueba la licencia: un PIN incorrecto se reintenta ahí.
      await enter(profile, pin);
      setPinFor(null);
      return true;
    } catch (err) {
      if (err?.code === 'pin_incorrect') return false;
      setPinFor(null);
      showError(err);
      return true;
    }
  };

  const takeOver = async () => {
    const selection = inUse;
    setInUse(null);
    setBusyId(selection?.profile?.id ?? null);
    try {
      const result = await takeOverProfileLicense(brand, selection);
      if (result.status === 'ok') {
        resetHomeMemory();
        navigate(toScreen(nextStepAfterEnter(result).route));
      } else {
        setMessage(t('profile.errorActivate'));
      }
    } finally {
      setBusyId(null);
    }
  };

  const logout = () => {
    try {
      panaccessService.logout();
    } catch {
      // noop: se sale igual
    }
    forgetActiveProfile();
    setLoggedOut();
    navigate('login');
  };

  const elsewhere = inUse?.activeElsewhere?.[0]?.deviceModel || t('profile.otherDevice');

  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <FullScreenImage source={theme.assets.background} />
      <View style={styles.dim} />
      <View style={styles.content}>
        <Image source={theme.logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('profile.whoIsWatching')}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.sub}>{t('profile.loadingProfiles')}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={styles.sub}>{loadError}</Text>
            <View style={styles.row}>
              <FocusButton label={t('common.retry')} onPress={load} hasTVPreferredFocus primary />
              <FocusButton label={t('profile.continueWithoutProfile')} onPress={leaveWithoutProfiles} style={styles.gap} />
            </View>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.sub}>{t('profile.noProfiles')}</Text>
            <FocusButton label={t('profile.continueWithoutProfile')} onPress={leaveWithoutProfiles} hasTVPreferredFocus primary />
          </View>
        ) : (
          <ScrollView horizontal contentContainerStyle={styles.grid} showsHorizontalScrollIndicator={false}>
            {profiles.map((p, i) => (
              <ProfileCard
                key={String(p.id)}
                profile={p}
                avatar={theme.assets.avatars?.[p.avatarId] || null}
                busy={busyId === p.id}
                disabled={busyId != null}
                hasTVPreferredFocus={i === 0}
                onPress={() => select(p)}
              />
            ))}
          </ScrollView>
        )}

        <FocusButton label={t('common.backLogout')} onPress={logout} style={styles.logout} />
      </View>

      {pinFor ? (
        <PinModal title={pinFor.name} message={t('profile.enterPin')} onSubmit={submitPin} onCancel={() => setPinFor(null)} />
      ) : null}
      {inUse ? (
        <ConfirmModal
          title={t('profile.inUseTitle')}
          message={t('profile.inUseMessage', {name: inUse.profile?.name || '', device: elsewhere})}
          confirmLabel={t('profile.inUseConfirm')}
          onConfirm={takeOver}
          onCancel={() => setInUse(null)}
        />
      ) : null}
      {message ? <MessageModal message={message} onClose={() => setMessage(null)} /> : null}
    </View>
  );
}

// _profile.scss a 1920×1080.
const styles = createScaledStyles({
  root: {flex: 1},
  dim: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)'},
  content: {flex: 1, alignItems: 'center', paddingTop: 80, paddingBottom: 60},
  logo: {width: 320, height: 96, marginBottom: 24},
  title: {color: '#fff', fontSize: 52, fontWeight: '700', marginBottom: 56},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  sub: {color: 'rgba(255,255,255,0.85)', fontSize: 26, marginVertical: 20, textAlign: 'center', maxWidth: 1100},
  row: {flexDirection: 'row'},
  gap: {marginLeft: 24},
  grid: {alignItems: 'flex-start', paddingHorizontal: 40},
  card: {width: 240, marginHorizontal: 22, alignItems: 'center'},
  avatar: {width: 200, height: 200, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
  avatarImage: {width: 200, height: 200},
  avatarLetter: {color: '#fff', fontSize: 88, fontWeight: '700'},
  busy: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)'},
  name: {color: 'rgba(255,255,255,0.8)', fontSize: 28, marginTop: 16, maxWidth: 240},
  nameFocused: {color: '#fff', fontWeight: '700'},
  meta: {color: 'rgba(255,255,255,0.7)', fontSize: 20, marginTop: 4},
  logout: {marginTop: 32},
});
