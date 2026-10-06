import * as React from 'react';
import {useState} from 'react';
import {Image, Text, TextInput, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {clearSessionBeforeNewLogin, loginAndActivateLicense} from '@appvideo/core/services/loginFlow';
import {classifyError, ERROR_TYPES} from '@appvideo/core/cv/errorClassifier';
import {FocusButton} from '../components/FocusButton';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key) => i18n.t(key);

/** Mismo mensaje por tipo de error que `LoginPage` de la web. */
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

function Field({value, onChangeText, placeholder, secure, hasTVPreferredFocus, theme}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        {color: theme.text, backgroundColor: theme.surface},
        focused && {borderColor: theme.focusBorder, backgroundColor: theme.surfaceFocused},
      ]}
    />
  );
}

export function LoginScreen({navigate}) {
  const theme = getTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (submitting) return;
    if (!username.trim() || !password.trim()) {
      setError(t('login.errorGeneric'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      clearSessionBeforeNewLogin();
      await loginAndActivateLicense(
        getActiveBrandConfig(),
        {username: username.trim(), password: password.trim()},
        {
          autoActivateLicense: true,
          failIfInUse: true,
          activationRecursive: true,
          storeClientConfig: true,
          storeLicenses: true,
        },
      );
      navigate('home');
    } catch (err) {
      devLog('login: error', err?.message, err?.errorInfo?.type);
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <View style={[styles.card, {borderColor: theme.surfaceFocused}]}>
        {theme.logo ? <Image source={theme.logo} style={styles.logo} resizeMode="contain" /> : null}
        <Text style={[styles.title, {color: theme.text}]}>{t('login.title')}</Text>
        <Field
          value={username}
          onChangeText={setUsername}
          placeholder={t('login.userPlaceholder')}
          hasTVPreferredFocus
          theme={theme}
        />
        <Field value={password} onChangeText={setPassword} placeholder={t('login.passwordPlaceholder')} secure theme={theme} />
        {error ? <Text style={[styles.error, {color: theme.error}]}>{error}</Text> : null}
        <FocusButton
          label={submitting ? '…' : t('login.submit')}
          onPress={submit}
          primary
          disabled={submitting}
          style={styles.submit}
        />
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  card: {width: 720, padding: 48, borderRadius: 24, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)'},
  logo: {width: 300, height: 70, alignSelf: 'center', marginBottom: 16},
  title: {fontSize: 30, textAlign: 'center', marginBottom: 32},
  input: {fontSize: 26, paddingHorizontal: 24, paddingVertical: 18, borderRadius: 12, borderWidth: 3, borderColor: 'transparent', marginBottom: 20},
  error: {fontSize: 22, marginBottom: 16, textAlign: 'center'},
  submit: {marginTop: 12},
});
