import * as React from 'react';
import {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {clearSessionBeforeNewLogin, loginAndActivateLicense} from '@appvideo/core/services/loginFlow';
import {classifyError, ERROR_TYPES} from '@appvideo/core/cv/errorClassifier';
import {resolvePostLoginRoute} from '@appvideo/core/utils/navigation';
import {CssBackground} from '../components/CssBackground';
import {EyeIcon} from '../components/EyeIcon';
import {FocusRing} from '../components/FocusRing';
import {MessageModal} from '../components/MessageModal';
import {FullScreenImage} from '../components/FullScreenImage';
import {getTheme} from '../theme';
import {screenForWebRoute} from '../routes';
import {createScaledStyles, ENTRY_SCALE, px} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key) => i18n.t(key);

/** Mismo mensaje por tipo de error que LoginPage de la web. */
function loginErrorMessage(err) {
  const info = err?.errorInfo || classifyError(err);
  switch (info.type) {
    case ERROR_TYPES.NETWORK:
      return t('login.errorNetwork');
    case ERROR_TYPES.TIMEOUT:
      return t('login.errorTimeout');
    case ERROR_TYPES.SERVER:
      return t('login.errorServer');
    case ERROR_TYPES.AUTH:
      return t('login.errorAuth');
    default:
      return info.userMessage || err?.message || t('login.errorGeneric');
  }
}

function LoginInput({theme, inputRef, secure, rightSlot, hasTVPreferredFocus, ...props}) {
  const [focused, setFocused] = useState(false);
  const l = theme.login;
  return (
    <View style={styles.field}>
      <TextInput
        ref={inputRef}
        {...props}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        hasTVPreferredFocus={hasTVPreferredFocus}
        placeholderTextColor={l.inputPlaceholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {backgroundColor: focused ? l.inputFocusedBg : l.inputBg, borderColor: l.inputBorder, color: l.inputText},
          rightSlot ? styles.inputWithToggle : null,
        ]}
      />
      {rightSlot}
      <FocusRing visible={focused} radius={12} scale={ENTRY_SCALE} />
    </View>
  );
}

/**
 * Login de TV con el diseño de appVideo (spec §5.2, LoginPage + _login.scss):
 * fondo de la marca con velo, card con logo, título, usuario, contraseña con
 * ojo e "Ingresar". En intv no hay QR, olvidé contraseña, UDID ni social.
 */
export function LoginScreen({navigate}) {
  const theme = getTheme();
  const l = theme.login;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toggleFocused, setToggleFocused] = useState(false);
  const [submitFocused, setSubmitFocused] = useState(false);
  const passwordRef = React.useRef(null);

  const submit = async () => {
    if (submitting) return;
    if (!username.trim() || !password.trim()) {
      setError(t('login.errorAuth'));
      return;
    }
    setSubmitting(true);
    try {
      clearSessionBeforeNewLogin();
      const brand = getActiveBrandConfig();
      await loginAndActivateLicense(
        brand,
        {username: username.trim(), password: password.trim()},
        {autoActivateLicense: true, failIfInUse: true, activationRecursive: true, storeClientConfig: true, storeLicenses: true},
      );
      navigate(screenForWebRoute(resolvePostLoginRoute(brand)));
    } catch (err) {
      devLog('login: error', err?.message, err?.errorInfo?.type);
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const eyeToggle = (
    <Pressable
      onPress={() => setShowPassword((v) => !v)}
      onFocus={() => setToggleFocused(true)}
      onBlur={() => setToggleFocused(false)}
      style={styles.toggle}>
      <EyeIcon open={showPassword} size={px(20, ENTRY_SCALE)} color={toggleFocused ? '#fff' : l.toggleText} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FullScreenImage source={theme.assets.background} blurRadius={2} />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />

      <View style={[styles.card, {backgroundColor: l.cardBackground}]}>
        <Image source={theme.logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('login.title')}</Text>

        <LoginInput
          theme={theme}
          value={username}
          onChangeText={setUsername}
          placeholder={t('login.userPlaceholder')}
          editable={!submitting}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          hasTVPreferredFocus
        />
        <LoginInput
          theme={theme}
          inputRef={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder={t('login.passwordPlaceholder')}
          editable={!submitting}
          secure={!showPassword}
          returnKeyType="done"
          onSubmitEditing={submit}
          rightSlot={eyeToggle}
        />

        <View style={styles.submitWrap}>
          <Pressable
            onPress={submit}
            disabled={submitting}
            onFocus={() => setSubmitFocused(true)}
            onBlur={() => setSubmitFocused(false)}
            style={[styles.submit, submitting && styles.submitDisabled]}>
            {submitting ? (
              <View style={[StyleSheet.absoluteFill, styles.submitDisabledBg]} />
            ) : (
              <CssBackground value={l.submitBg} radius={px(999)} />
            )}
            <Text style={[styles.submitText, {color: l.submitText}]}>
              {submitting ? t('login.submitting') : t('login.submit')}
            </Text>
          </Pressable>
          <FocusRing visible={submitFocused} radius={999} scale={ENTRY_SCALE} />
        </View>
      </View>

      {error ? <MessageModal message={error} onClose={() => setError('')} /> : null}
    </View>
  );
}

// Medidas de la web a 1920×1080 (1rem = 16px), ver docs/VEGA_DESIGN_SPEC.md §5.2.
const styles = createScaledStyles({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', padding: 24},
  veil: {backgroundColor: 'rgba(8,12,18,0.45)'},
  card: {
    width: 448,
    paddingTop: 36,
    paddingHorizontal: 32,
    paddingBottom: 32,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 64,
    shadowOffset: {width: 0, height: 24},
  },
  logo: {width: 176, height: 40, alignSelf: 'center', marginBottom: 16},
  title: {fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.95)', textAlign: 'center', marginBottom: 24},
  field: {marginBottom: 13.6, justifyContent: 'center'},
  input: {minHeight: 52, paddingVertical: 14.4, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, fontSize: 15.7},
  inputWithToggle: {paddingRight: 48},
  toggle: {position: 'absolute', right: 0, width: 48, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 12},
  submitWrap: {marginTop: 4},
  submit: {borderRadius: 999, paddingVertical: 15.2, paddingHorizontal: 16, alignItems: 'center', overflow: 'hidden'},
  submitDisabled: {opacity: 0.5},
  submitDisabledBg: {backgroundColor: 'rgba(255,255,255,0.1)'},
  submitText: {fontSize: 16, fontWeight: '600', letterSpacing: 0.32},
}, ENTRY_SCALE);
