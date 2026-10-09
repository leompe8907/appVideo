import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {
  changePassword,
  confirmPasswordChangeOtp,
  requestAccountDeletion,
  requestPasswordChangeOtp,
} from '@appvideo/core/services/accountSecurityService';
import {listLinkedDevices, revokeLinkedDevice} from '@appvideo/core/services/linkedDevicesService';
import {getStoredDeviceId} from '@appvideo/core/services/deviceSessionService';
import {ConfirmModal} from '../components/ConfirmModal';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

/**
 * Paneles nativos de Mi Cuenta (ChangePasswordPanel, LinkedDevicesPanel y
 * CloseAccountPanel de la web): mismos pasos, textos y servicios del núcleo.
 * Los usa AccountPage cuando la marca tiene `login.deviceSession.enabled` y
 * hay sesión de dispositivo; si no, sigue el QR.
 */

const t = (key, defaultValue, opts) => i18n.t(key, {defaultValue, ...opts});

const MIN_LENGTH = 8;
const MAX_LENGTH = 255;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 20;

// Política de contraseña (igual que la web; el backend vuelve a validarla).
const PASSWORD_ALLOWED_CHARS_RE = /^[A-Za-z0-9_!@#$%^&*()+=[\]{};:'",.<>/?~`|\\-]+$/;
function passwordPolicyError(password) {
  if (!password || password.length < MIN_LENGTH || password.length > MAX_LENGTH) {
    return t('account.changePasswordTooShort', `La contraseña debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres.`, {count: MIN_LENGTH});
  }
  if (!PASSWORD_ALLOWED_CHARS_RE.test(password)) return t('account.changePasswordInvalidChars', 'La contraseña tiene caracteres no permitidos.');
  if (!/[A-Z]/.test(password)) return t('account.changePasswordMissingUpper', 'La contraseña debe incluir al menos una letra mayúscula.');
  if (!/[0-9]/.test(password)) return t('account.changePasswordMissingNumber', 'La contraseña debe incluir al menos un número.');
  return null;
}

const OTP_STEP_ERROR_CODES = new Set(['otp_incorrect', 'otp_locked', 'otp_missing_or_expired']);
const OTP_ERROR_I18N = {
  email_mismatch: ['changeOtpEmailMismatch', 'El correo no coincide con tu cuenta.'],
  no_email: ['changeOtpNoEmail', 'Tu cuenta no tiene un correo registrado para enviar el código.'],
  otp_cooldown: ['changeOtpCooldown', 'Ya te enviamos un código hace poco. Espera un momento antes de pedir otro.'],
  otp_email_failed: ['changeOtpEmailFailed', 'No se pudo enviar el código. Intenta de nuevo en unos segundos.'],
  otp_incorrect: ['changeOtpIncorrect', 'El código no es correcto.'],
  otp_missing_or_expired: ['changeOtpMissingOrExpired', 'El código expiró o no se ha solicitado ninguno. Pide uno nuevo.'],
  otp_locked: ['changeOtpLocked', 'Demasiados intentos fallidos con este código. Pide uno nuevo.'],
  password_policy_violation: ['changeOtpPasswordPolicyViolation', 'La nueva contraseña no cumple con la política requerida.'],
  password_rejected_by_panaccess: ['changeOtpPasswordRejected', 'El servidor rechazó la nueva contraseña. Intenta con otra.'],
  panaccess_integration_error: ['changeOtpPanaccessError', 'Ocurrió un problema al comunicarse con el servidor. Intenta de nuevo.'],
  panaccess_unavailable: ['changeOtpPanaccessUnavailable', 'El servidor no está disponible en este momento. Intenta más tarde.'],
  panaccess_timeout: ['changeOtpPanaccessTimeout', 'La conexión con el servidor tardó demasiado. Intenta de nuevo.'],
};
const DELETE_ERROR_I18N = {
  email_mismatch: ['deleteAccountEmailMismatch', 'El correo no coincide con tu cuenta.'],
  already_closed: ['deleteAccountAlreadyClosed', 'Esta cuenta ya está cerrada.'],
  closure_already_scheduled: ['deleteAccountAlreadyScheduled', 'Ya hay una eliminación en curso para esta cuenta.'],
  no_email_on_file: ['deleteAccountNoEmailOnFile', 'No hay un correo registrado para esta cuenta. Contacta a soporte.'],
};
function translateError(table, err, fallback) {
  const entry = table[err?.data?.code];
  return entry ? t(`account.${entry[0]}`, entry[1]) : err?.message || fallback;
}

const DEVICE_TYPE_LABELS = {web: 'PC / Web', lg: 'LG (webOS)', samsung: 'Samsung (Tizen)', vega: 'Fire TV (Vega)', firetv: 'Fire TV'};

// ---------------------------------------------------------------- piezas

function Field({label, value, onChangeText, secure, keyboardType, placeholder, maxLength, disabled, hasTVPreferredFocus}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.4)"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={maxLength}
        editable={!disabled}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && {borderColor: theme.focusColor, backgroundColor: 'rgba(255,255,255,0.1)'}]}
      />
    </View>
  );
}

function Button({label, onPress, kind = 'primary', disabled, hasTVPreferredFocus, style}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  const bg = kind === 'danger' ? '#c0392b' : kind === 'ghost' ? 'rgba(255,255,255,0.08)' : theme.primary;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.btn, {backgroundColor: bg, borderColor: focused ? theme.focusColor : 'transparent'}, disabled && styles.disabled, style]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Message({kind, children}) {
  if (!children) return null;
  return <Text style={[styles.msg, kind === 'error' ? styles.error : kind === 'success' ? styles.success : styles.hint]}>{children}</Text>;
}

function ShowPasswordToggle({show, onToggle}) {
  return (
    <Button
      kind="ghost"
      label={show ? `☑ ${t('account.hidePassword', 'Ocultar contraseña')}` : `☐ ${t('account.showPassword', 'Mostrar contraseña')}`}
      onPress={onToggle}
      style={styles.toggle}
    />
  );
}

// ---------------------------------------------------------------- Cambiar contraseña

function OtpChangePasswordFlow({brandConfig, brand, onLoggedOut}) {
  const [step, setStep] = useState('request'); // request | verify | new_password | success
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step !== 'success') return undefined;
    const timer = setTimeout(onLoggedOut, 3000);
    return () => clearTimeout(timer);
  }, [step, onLoggedOut]);

  const sendCode = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const result = await requestPasswordChangeOtp(brandConfig, brand, email.trim());
      if (!result?.success) throw new Error(result?.message || t('account.changeOtpRequestError', 'No se pudo enviar el código.'));
      setMaskedEmail(result.masked_email || '');
      setStep('verify');
    } catch (err) {
      setError(translateError(OTP_ERROR_I18N, err, t('account.changeOtpRequestError', 'No se pudo enviar el código.')));
    } finally {
      setBusy(false);
    }
  };

  const continueFromCode = () => {
    setError('');
    if (otp.trim().length !== OTP_LENGTH || !/^\d+$/.test(otp.trim())) {
      setError(t('account.changeOtpInvalidFormat', `Ingresa los ${OTP_LENGTH} dígitos del código.`));
      return;
    }
    setStep('new_password');
  };

  const save = async () => {
    if (busy) return;
    setError('');
    const policy = passwordPolicyError(newPass);
    if (policy) return setError(policy);
    if (newPass !== confirmPass) return setError(t('account.changePasswordMismatch', 'Las contraseñas no coinciden.'));
    setBusy(true);
    try {
      const result = await confirmPasswordChangeOtp(brandConfig, brand, otp.trim(), newPass);
      if (!result?.success) throw new Error(result?.message || t('account.changePasswordError', 'No se pudo cambiar la contraseña.'));
      setStep('success');
    } catch (err) {
      const message = translateError(OTP_ERROR_I18N, err, t('account.changePasswordError', 'No se pudo cambiar la contraseña.'));
      if (OTP_STEP_ERROR_CODES.has(err?.data?.code)) setStep('verify');
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'success') {
    return (
      <View style={styles.panel}>
        <Message kind="success">
          {t('account.changeOtpSuccess', '¡Contraseña actualizada! Se cerró sesión en todos tus dispositivos por tu seguridad. Inicia sesión de nuevo con tu nueva contraseña.')}
        </Message>
        <Button label={t('account.goToLogin', 'Ir a iniciar sesión')} onPress={onLoggedOut} hasTVPreferredFocus />
      </View>
    );
  }

  if (step === 'verify') {
    return (
      <View style={styles.panel}>
        <Message>
          {maskedEmail
            ? t('account.changeOtpVerifyHintWithEmail', `Hemos enviado a tu correo ${maskedEmail} un código de ${OTP_LENGTH} dígitos. No olvides revisar la bandeja de spam.`, {email: maskedEmail, count: OTP_LENGTH})
            : t('account.changeOtpVerifyHintNoEmail', `Hemos enviado un código de ${OTP_LENGTH} dígitos a tu correo. No olvides revisar la bandeja de spam.`, {count: OTP_LENGTH})}
        </Message>
        <Field
          label={t('account.changeOtpCodeLabel', 'Código de acceso único')}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          disabled={busy}
          hasTVPreferredFocus
        />
        <Message kind="error">{error}</Message>
        <View style={styles.row}>
          <Button kind="ghost" label={t('account.changeOtpCancel', 'Cancelar')} disabled={busy} onPress={() => { setStep('request'); setOtp(''); setError(''); }} />
          <Button label={t('account.changeOtpContinue', 'Continuar')} disabled={busy} onPress={continueFromCode} />
        </View>
        <Button kind="ghost" label={t('account.changeOtpResend', '¿No recibiste el código? Enviar de nuevo')} disabled={busy} onPress={sendCode} />
      </View>
    );
  }

  if (step === 'new_password') {
    return (
      <View style={styles.panel}>
        <Message>{t('account.changeOtpNewPasswordHint', 'Ingresa tu nueva contraseña.')}</Message>
        <Field label={t('account.changePasswordNewLabel', 'Nueva contraseña')} value={newPass} onChangeText={setNewPass} secure={!show} maxLength={MAX_LENGTH} disabled={busy} hasTVPreferredFocus />
        <Text style={styles.fieldHint}>
          {t('account.changePasswordRulesHint', 'Entre 8 y 255 caracteres, con al menos una mayúscula y un número. También puedes usar símbolos como ! @ # $ % ^ & * ( ) + = - _ [ ] { } ; : \' " , . < > / ? ~ ` |')}
        </Text>
        <Field label={t('account.changePasswordConfirmLabel', 'Confirmar nueva contraseña')} value={confirmPass} onChangeText={setConfirmPass} secure={!show} maxLength={MAX_LENGTH} disabled={busy} />
        <ShowPasswordToggle show={show} onToggle={() => setShow((s) => !s)} />
        <Message kind="error">{error}</Message>
        <View style={styles.row}>
          <Button kind="ghost" label={t('account.changeOtpBack', 'Atrás')} disabled={busy} onPress={() => { setError(''); setStep('verify'); }} />
          <Button
            label={busy ? t('account.changePasswordSubmitting', 'Actualizando...') : t('account.changeOtpSave', 'Guardar contraseña')}
            disabled={busy}
            onPress={save}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Message>{t('account.changeOtpRequestHint', 'Enviaremos un código de verificación a tu correo electrónico.')}</Message>
      <Field
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        placeholder={t('account.changeOtpEmailPlaceholder', 'Escribe tu correo')}
        disabled={busy}
        hasTVPreferredFocus
      />
      <Message kind="error">{error}</Message>
      <Button
        label={busy ? t('account.changeOtpSending', 'Enviando...') : t('account.changeOtpSendCode', 'Enviar correo')}
        disabled={busy || !email.trim()}
        onPress={sendCode}
      />
    </View>
  );
}

function OldPasswordChangeFlow({brandConfig, brand, onLoggedOut}) {
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(onLoggedOut, 3000);
    return () => clearTimeout(timer);
  }, [success, onLoggedOut]);

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!current.trim()) return setError(t('account.changePasswordCurrentRequired', 'Ingresa tu contraseña actual.'));
    const policy = passwordPolicyError(newPass);
    if (policy) return setError(policy);
    if (newPass !== confirmPass) return setError(t('account.changePasswordMismatch', 'Las contraseñas no coinciden.'));
    setBusy(true);
    try {
      const result = await changePassword(brandConfig, brand, current.trim(), newPass);
      if (!result?.success) throw new Error(result?.message || t('account.changePasswordError', 'No se pudo cambiar la contraseña.'));
      setSuccess(true);
    } catch (err) {
      setError(err?.message || t('account.changePasswordError', 'No se pudo cambiar la contraseña.'));
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <View style={styles.panel}>
        <Message kind="success">
          {t('account.changePasswordSuccess', 'Contraseña actualizada. Por seguridad cerramos tu sesión en este dispositivo: inicia sesión de nuevo con tu nueva contraseña.')}
        </Message>
        <Button label={t('account.goToLogin', 'Ir a iniciar sesión')} onPress={onLoggedOut} hasTVPreferredFocus />
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <Message>{t('account.changePasswordWarning', 'Al cambiar tu contraseña se cerrará el acceso de todos tus dispositivos vinculados, incluido este.')}</Message>
      <Field label={t('account.changePasswordCurrentLabel', 'Contraseña actual')} value={current} onChangeText={setCurrent} secure={!show} disabled={busy} hasTVPreferredFocus />
      <Field label={t('account.changePasswordNewLabel', 'Nueva contraseña')} value={newPass} onChangeText={setNewPass} secure={!show} maxLength={MAX_LENGTH} disabled={busy} />
      <Field label={t('account.changePasswordConfirmLabel', 'Confirmar nueva contraseña')} value={confirmPass} onChangeText={setConfirmPass} secure={!show} maxLength={MAX_LENGTH} disabled={busy} />
      <ShowPasswordToggle show={show} onToggle={() => setShow((s) => !s)} />
      <Message kind="error">{error}</Message>
      <Button label={busy ? t('account.changePasswordSubmitting', 'Actualizando...') : t('account.changePasswordSubmit', 'Cambiar contraseña')} disabled={busy} onPress={submit} />
    </View>
  );
}

export function ChangePasswordPanel({brandConfig, brand, onLoggedOut}) {
  const flow = brandConfig?.login?.deviceSession?.changePasswordFlow === 'old_password' ? 'old_password' : 'otp';
  return flow === 'old_password' ? (
    <OldPasswordChangeFlow brandConfig={brandConfig} brand={brand} onLoggedOut={onLoggedOut} />
  ) : (
    <OtpChangePasswordFlow brandConfig={brandConfig} brand={brand} onLoggedOut={onLoggedOut} />
  );
}

// ---------------------------------------------------------------- Dispositivos vinculados

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export function LinkedDevicesPanel({brandConfig, brand}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const selfId = getStoredDeviceId(brand);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setDevices(await listLinkedDevices(brandConfig, brand));
    } catch (err) {
      setLoadError(err?.message || t('account.linkedDevicesError', 'No se pudieron cargar los dispositivos vinculados.'));
    } finally {
      setLoading(false);
    }
  }, [brandConfig, brand]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id) => {
    setPendingId(null);
    setRevokingId(id);
    setActionError('');
    try {
      const result = await revokeLinkedDevice(brandConfig, brand, id);
      if (!result?.ok) throw new Error(t('account.linkedDevicesRevokeError', 'No se pudo revocar el dispositivo.'));
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setActionError(err?.message || t('account.linkedDevicesRevokeError', 'No se pudo revocar el dispositivo.'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <View style={styles.panelWide}>
      <View style={styles.toolbar}>
        <Button kind="ghost" label={t('account.linkedDevicesRefresh', 'Actualizar')} disabled={loading} onPress={load} />
      </View>
      {loading ? (
        <Message>{t('common.loading', 'Cargando...')}</Message>
      ) : loadError ? (
        <Message kind="error">{loadError}</Message>
      ) : devices.length === 0 ? (
        <Message>{t('account.linkedDevicesEmpty', 'No tienes dispositivos vinculados todavía.')}</Message>
      ) : (
        <>
          <Message kind="error">{actionError}</Message>
          {devices.map((d, i) => {
            const isSelf = selfId != null && String(d.id) === String(selfId);
            return (
              <View key={String(d.id)} style={styles.deviceRow}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceType}>
                    {DEVICE_TYPE_LABELS[d.device_type] || d.device_type || t('account.linkedDevicesUnknownType', 'Dispositivo')}
                    {isSelf ? `  ·  ${t('account.linkedDevicesSelfBadge', 'Este dispositivo')}` : ''}
                  </Text>
                  {d.device_model ? <Text style={styles.deviceMeta}>{d.device_model}</Text> : null}
                  <Text style={styles.deviceMeta}>{`${t('account.linkedDevicesLastSeen', 'Última conexión')}: ${formatDate(d.last_seen_at)}`}</Text>
                  {d.city || d.country ? <Text style={styles.deviceMeta}>{[d.city, d.country].filter(Boolean).join(', ')}</Text> : null}
                </View>
                <Button
                  kind="danger"
                  hasTVPreferredFocus={i === 0}
                  disabled={revokingId === d.id}
                  label={
                    revokingId === d.id
                      ? t('common.loading', 'Cargando...')
                      : isSelf
                        ? t('account.linkedDevicesLogoutHere', 'Remover')
                        : t('account.linkedDevicesRevoke', 'Revocar')
                  }
                  onPress={() => setPendingId(d.id)}
                />
              </View>
            );
          })}
        </>
      )}
      {pendingId != null ? (
        <ConfirmModal
          title={t('account.linkedDevicesRevokeConfirmTitle', 'Revocar dispositivo')}
          message={t('account.linkedDevicesRevokeConfirmMessage', 'Este dispositivo dejará de tener acceso a tu cuenta. ¿Deseas continuar?')}
          confirmLabel={t('settings.confirm', 'Confirmar')}
          onConfirm={() => revoke(pendingId)}
          onCancel={() => setPendingId(null)}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Eliminar cuenta

export function CloseAccountPanel({brandConfig, brand}) {
  const [step, setStep] = useState('warning'); // warning | email | check_email
  const [understood, setUnderstood] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [scheduledFor, setScheduledFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resetAll = () => {
    setStep('warning');
    setUnderstood(false);
    setEmail('');
    setMaskedEmail('');
    setScheduledFor(null);
    setError('');
    setCooldown(0);
  };

  const send = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await requestAccountDeletion(brandConfig, brand, {email: email.trim(), reason: 'user_app_delete_request'});
      if (!result?.success) throw new Error(result?.message || t('account.deleteAccountError', 'No se pudo eliminar la cuenta.'));
      setMaskedEmail(result.masked_email || '');
      setScheduledFor(result.scheduled_for || null);
      setStep('check_email');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(translateError(DELETE_ERROR_I18N, err, t('account.deleteAccountError', 'No se pudo eliminar la cuenta.')));
    } finally {
      setBusy(false);
    }
  };

  let cutoff = null;
  if (scheduledFor) {
    try {
      cutoff = new Intl.DateTimeFormat(i18n.language || undefined, {dateStyle: 'long'}).format(new Date(scheduledFor));
    } catch {
      cutoff = scheduledFor;
    }
  }

  if (step === 'check_email') {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>{t('account.deleteAccountCheckEmailTitle', 'Revisa tu correo electrónico')}</Text>
        <Message>{t('account.deleteAccountCheckEmailSent', 'Hemos enviado un enlace para eliminar tu cuenta a:')}</Message>
        <Text style={styles.badge}>{maskedEmail}</Text>
        {cutoff ? (
          <Message>{t('account.deleteAccountCutoffNotice', `Tu suscripción estará activa hasta finalizar la fecha de corte: ${cutoff}`, {date: cutoff})}</Message>
        ) : null}
        <Message>{t('account.deleteAccountWillExecuteOnCutoff', 'La eliminación se ejecutará en esa fecha.')}</Message>
        <Message>{t('account.deleteAccountCheckEmailSpamHint', 'Si no encuentras el correo, revisa la carpeta de spam o solicita un nuevo envío.')}</Message>
        <Message kind="error">{error}</Message>
        <View style={styles.row}>
          <Button kind="ghost" label={t('account.deleteAccountBack', 'Volver')} onPress={resetAll} hasTVPreferredFocus />
          <Button
            label={cooldown > 0 ? t('account.deleteAccountResendCooldown', `Reenviar correo (${cooldown}s)`, {count: cooldown}) : t('account.deleteAccountResend', 'Reenviar correo')}
            disabled={busy || cooldown > 0}
            onPress={send}
          />
        </View>
      </View>
    );
  }

  if (step === 'email') {
    return (
      <View style={styles.panel}>
        <Message>{t('account.deleteAccountEmailStepHint', 'Para continuar, escribe el correo asociado a tu cuenta.')}</Message>
        <Field value={email} onChangeText={setEmail} keyboardType="email-address" placeholder={t('account.deleteAccountEmailPlaceholder', 'Escribe tu correo')} disabled={busy} hasTVPreferredFocus />
        <Message kind="error">{error}</Message>
        <View style={styles.row}>
          <Button kind="ghost" label={t('account.deleteAccountCancel', 'Cancelar')} disabled={busy} onPress={() => { setError(''); setStep('warning'); }} />
          <Button
            label={busy ? t('account.deleteAccountSending', 'Enviando...') : t('account.deleteAccountSendConfirmEmail', 'Enviar correo de confirmación')}
            disabled={busy || !email.trim()}
            onPress={send}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>{t('account.deleteAccountWarningTitle', 'Eliminar tu cuenta es una acción permanente')}</Text>
        <Text style={styles.dangerText}>
          {t('account.deleteAccountWarning', 'Eliminar tu cuenta es irreversible: perderás acceso al servicio y a todo tu contenido asociado de forma permanente.')}
        </Text>
      </View>
      {[
        t('account.deleteAccountEffectProfile', 'Se eliminará tu perfil y tus datos personales.'),
        t('account.deleteAccountEffectSubscription', 'Perderás acceso a tu suscripción.'),
        t('account.deleteAccountEffectDevices', 'Se cerrará la sesión en todos tus dispositivos.'),
        t('account.deleteAccountEffectIrreversible', 'No podrás recuperar esta cuenta una vez eliminada.'),
      ].map((line) => (
        <Text key={line} style={styles.bullet}>{`•  ${line}`}</Text>
      ))}
      <Message>{t('account.deleteAccountCutoffGenericNotice', 'Tu suscripción estará activa hasta finalizar la fecha de corte.')}</Message>
      <Button
        kind="ghost"
        style={styles.toggle}
        hasTVPreferredFocus
        label={`${understood ? '☑' : '☐'} ${t('account.deleteAccountUnderstoodLabel', 'Entiendo que esta acción es permanente y que no podré recuperar mi cuenta ni su contenido.')}`}
        onPress={() => setUnderstood((u) => !u)}
      />
      <Message kind="error">{error}</Message>
      <View style={styles.row}>
        <Button kind="ghost" label={t('account.deleteAccountCancel', 'Cancelar')} onPress={() => { setUnderstood(false); setError(''); }} />
        <Button kind="danger" label={t('account.deleteAccountSubmit', 'Eliminar cuenta')} disabled={!understood} onPress={() => setConfirmOpen(true)} />
      </View>
      {confirmOpen ? (
        <ConfirmModal
          title={t('account.deleteAccountConfirmTitle', 'Eliminar cuenta')}
          message={t('account.deleteAccountConfirmMessage', '¿Seguro que quieres continuar? Te pediremos confirmar con tu correo.')}
          confirmLabel={t('settings.confirm', 'Confirmar')}
          onConfirm={() => {
            setConfirmOpen(false);
            setError('');
            setStep('email');
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </View>
  );
}

// _account-security.scss, escalado como el resto de Mi Cuenta.
const styles = createScaledStyles({
  panel: {maxWidth: 900},
  panelWide: {maxWidth: 1180},
  toolbar: {flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8},
  field: {marginBottom: 18},
  label: {color: 'rgba(255,255,255,0.8)', fontSize: 22, marginBottom: 8},
  fieldHint: {color: 'rgba(255,255,255,0.65)', fontSize: 19, lineHeight: 26, marginTop: -6, marginBottom: 18},
  input: {
    color: '#fff',
    fontSize: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  row: {flexDirection: 'row', gap: 16, marginBottom: 14},
  btn: {alignSelf: 'flex-start', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, borderWidth: 3, marginBottom: 14},
  btnText: {color: '#fff', fontSize: 22, fontWeight: '600'},
  disabled: {opacity: 0.45},
  toggle: {borderRadius: 12},
  msg: {fontSize: 22, lineHeight: 30, marginBottom: 16},
  hint: {color: 'rgba(255,255,255,0.88)', padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)'},
  error: {color: '#ff8a8a'},
  success: {color: '#8ee6a4', padding: 16, borderRadius: 12, backgroundColor: 'rgba(80,200,120,0.12)'},
  heading: {color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 14},
  badge: {alignSelf: 'flex-start', color: '#fff', fontSize: 24, fontWeight: '600', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16},
  dangerCard: {padding: 20, borderRadius: 14, backgroundColor: 'rgba(255,138,138,0.12)', marginBottom: 18},
  dangerTitle: {color: '#ff8a8a', fontSize: 25, fontWeight: '700', marginBottom: 8},
  dangerText: {color: 'rgba(255,255,255,0.88)', fontSize: 21, lineHeight: 29},
  bullet: {color: 'rgba(255,255,255,0.88)', fontSize: 21, lineHeight: 29, marginBottom: 6},
  deviceRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 14},
  deviceInfo: {flex: 1, paddingRight: 16},
  deviceType: {color: '#fff', fontSize: 24, fontWeight: '600', marginBottom: 4},
  deviceMeta: {color: 'rgba(255,255,255,0.7)', fontSize: 19, marginTop: 2},
});
