import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';

export function ParentalPinGate({
  open,
  title,
  message,
  onSubmit,
  onCancel,
}) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const pinInputRef = useRef(null);
  const okBtnRef = useRef(null);

  const digits = useMemo(() => ['1','2','3','4','5','6','7','8','9','0'], []);

  const handleSubmit = useCallback(async () => {
    if (!open) return;
    const value = String(pin || '');
    if (!value) {
      setError(t('pinGate.enterPin', { defaultValue: 'Ingresa el PIN' }));
      return;
    }
    const ok = await onSubmit?.(value);
    if (!ok) {
      setError(t('pinGate.wrongPin', { defaultValue: 'PIN incorrecto' }));
      setPin('');
      try { pinInputRef.current?.focus?.(); } catch { /* noop */ }
    }
  }, [open, pin, onSubmit, t]);

  useEffect(() => {
    if (!open) return;
    setPin('');
    setError('');
    const tm = setTimeout(() => {
      try {
        pinInputRef.current?.focus?.();
      } catch { /* noop */ }
    }, 0);
    return () => clearTimeout(tm);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const key = e.key || e.code;
      const code = e.keyCode || e.which;
      const isBack = key === 'Backspace' || key === 'Back' || key === 'Escape' || code === 8 || code === 27;
      const isEnter = key === 'Enter' || code === 13 || code === 29443;
      if (isBack) {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (isEnter) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, handleSubmit, onCancel]);

  if (!open) return null;

  const effectiveTitle = title || t('parental.channelBlockedTitle', { defaultValue: 'Canal bloqueado' });
  const effectiveMessage = message || t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para continuar' });

  return (
    <div className="parental-pin-overlay" role="dialog" aria-modal="true" aria-label={effectiveTitle}>
      <div className="parental-pin-card">
        <div className="parental-pin-title">{effectiveTitle}</div>
        <div className="parental-pin-message">{effectiveMessage}</div>

        <input
          ref={pinInputRef}
          className="parental-pin-input"
          value={pin}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={t('pinGate.maskInput')}
          onChange={(e) => {
            setError('');
            const digitsOnly = String(e.target.value || '').replace(/\D/g, '').slice(0, 6);
            setPin(digitsOnly);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          tabIndex={isTV ? -1 : 0}
        />

        {error ? <div className="parental-pin-error">{error}</div> : null}

        <div className="parental-pin-pad" aria-label={t('pinGate.keypad', { defaultValue: 'Teclado numérico' })}>
          {digits.map((d) => (
            <button
              key={d}
              type="button"
              className="parental-pin-digit"
              onClick={() => {
                setError('');
                setPin((p) => (p.length >= 6 ? p : `${p}${d}`));
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="parental-pin-digit parental-pin-digit--action"
            onClick={() => setPin((p) => p.slice(0, -1))}
          >
            ⌫
          </button>
          <button
            ref={okBtnRef}
            type="button"
            className="parental-pin-digit parental-pin-digit--ok"
            onClick={() => handleSubmit()}
          >
            {t('pinGate.ok', { defaultValue: 'OK' })}
          </button>
        </div>

        <div className="parental-pin-actions">
          <button type="button" className="parental-pin-cancel" onClick={() => onCancel?.()}>
            {t('pinGate.cancel', { defaultValue: 'Cancelar' })}
          </button>
          <button type="button" className="parental-pin-ok" onClick={() => handleSubmit()}>
            {t('pinGate.confirm', { defaultValue: 'Confirmar' })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParentalPinGate;

