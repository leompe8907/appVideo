import * as React from 'react';
import {useState} from 'react';
import {BackHandler, Image, Modal, Pressable, StyleSheet, Text, TextInput, View, useTVEventHandler} from 'react-native';
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
import {QrCode} from '../components/QrCode';
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

function LoginInput({theme, inputRef, secure, rightSlot, hasTVPreferredFocus, onFocusChange, ...props}) {
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
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocusChange?.(false);
        }}
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

/** Botón secundario de TV (`.login-tv-action-button` de la web): píldora a todo el ancho. */
function ActionButton({label, onPress}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.actionWrap}>
      <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={styles.action}>
        <Text style={styles.actionText}>{label}</Text>
      </Pressable>
      <FocusRing visible={focused} radius={999} scale={ENTRY_SCALE} />
    </View>
  );
}

/** Modal con QR (registro / olvidé mi contraseña), como los de LoginPage de la web en TV. */
function QrModal({title, hint, url, onClose}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);
  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalHint}>{hint}</Text>
          <View style={styles.qrBox}>
            <QrCode value={url} size={px(240, ENTRY_SCALE)} />
          </View>
          <View>
            <Pressable
              hasTVPreferredFocus
              onPress={onClose}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.modalClose, {backgroundColor: theme.primary}]}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </Pressable>
            <FocusRing visible={focused} radius={999} scale={ENTRY_SCALE} />
          </View>
        </View>
      </View>
    </Modal>
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
  const [qrModal, setQrModal] = useState(null); // 'register' | 'forgot'
  // Elementos configurables por marca (LoginPage de la web en TV):
  // `login.forgotPassword` y `login.qrRegister` abren un QR.
  const loginCfg = getActiveBrandConfig()?.login || {};
  const forgotUrlRaw = typeof loginCfg.forgotPassword?.url === 'string' ? loginCfg.forgotPassword.url.trim() : '';
  const forgotUrl = forgotUrlRaw ? `${forgotUrlRaw}${forgotUrlRaw.includes('?') ? '&' : '?'}origin=app` : '';
  const showForgot = loginCfg.forgotPassword?.enabled === true && forgotUrl.length > 0;
  const registerCfg = loginCfg.qrRegister || getActiveBrandConfig()?.qrRegister;
  const registerUrl = typeof registerCfg?.url === 'string' ? registerCfg.url.trim() : '';
  const showRegister = registerCfg?.enabled === true && registerUrl.length > 0;
  const closeQr = React.useCallback(() => setQrModal(null), []);
  const passwordRef = React.useRef(null);
  const eyeRef = React.useRef(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Con texto, ▶ dentro del campo sólo mueve el cursor: que llegue al ojo.
  useTVEventHandler((evt) => {
    if (passwordFocused && evt?.eventType === 'right' && evt.eventKeyAction === 0) eyeRef.current?.requestTVFocus?.();
  });

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
      ref={eyeRef}
      onPress={() => setShowPassword((v) => !v)}
      onFocus={() => setToggleFocused(true)}
      onBlur={() => setToggleFocused(false)}
      style={styles.toggle}>
      <EyeIcon open={showPassword} size={px(20, ENTRY_SCALE)} color={toggleFocused ? '#fff' : l.toggleText} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <FullScreenImage source={theme.assets.loginBackground || theme.assets.background} blurRadius={2} />
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
          onFocusChange={setPasswordFocused}
        />

        {showForgot ? (
          <View style={styles.forgotRow}>
            <ActionButton label={t('login.forgotPassword')} onPress={() => setQrModal('forgot')} />
          </View>
        ) : null}

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

        {showRegister ? (
          <View style={styles.subscribeRow}>
            <Text style={styles.subscribeHint}>{t('login.noAccountYet')}</Text>
            <ActionButton label={t('login.subscribeHere')} onPress={() => setQrModal('register')} />
          </View>
        ) : null}
      </View>

      {qrModal === 'forgot' ? (
        <QrModal title={t('login.forgotPasswordTitle')} hint={t('login.forgotPasswordHint')} url={forgotUrl} onClose={closeQr} />
      ) : null}
      {qrModal === 'register' ? (
        <QrModal title={t('login.registerTitle')} hint={t('login.registerHint')} url={registerUrl} onClose={closeQr} />
      ) : null}

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
  // _login.scss en TV: .login-forgot-row, .login-subscribe-row, .login-tv-action-button.
  forgotRow: {marginTop: -2.4, marginBottom: 13.6},
  subscribeRow: {marginTop: 16, alignItems: 'center'},
  subscribeHint: {fontSize: 14, color: 'rgba(255,255,255,0.82)', marginBottom: 8},
  actionWrap: {alignSelf: 'stretch'},
  action: {paddingVertical: 10.4, paddingHorizontal: 24, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center'},
  actionText: {color: '#fff', fontSize: 14, fontWeight: '500'},
  modalOverlay: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)'},
  modalBox: {width: 420, padding: 28, borderRadius: 20, backgroundColor: 'rgba(24,24,28,0.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center'},
  modalTitle: {color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center'},
  modalHint: {color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 16, textAlign: 'center'},
  qrBox: {padding: 8, borderRadius: 8, backgroundColor: '#fff', marginBottom: 14.4},
  modalClose: {paddingVertical: 10, paddingHorizontal: 40, borderRadius: 999},
  modalCloseText: {color: '#fff', fontSize: 15, fontWeight: '600'},
}, ENTRY_SCALE);
