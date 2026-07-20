import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { FocusableInput } from '../navigation/FocusableInput';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';

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
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('parental-pin-gate');

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

  // Navegación (LEFT/RIGHT/UP/DOWN por geometría entre los dígitos y las
  // acciones, BACK cancela) delegada al motor central vía FocusManager, igual
  // que cualquier otro modal — reemplaza el listener de teclado propio que
  // este gate tenía antes (sin cobertura real de D-pad: nada movía el foco
  // entre los botones del teclado numérico).
  useEffect(() => {
    if (!open) return undefined;
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, {
      containerEl: rootRef.current,
      onBack: () => {
        onCancel?.();
      },
    });
    return () => {
      focusManager.pop(zoneId);
    };
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    setPin('');
    setError('');
    const tm = setTimeout(() => {
      // En TV el input queda fuera del orden de foco (tabIndex=-1): el PIN se
      // ingresa con el teclado numérico en pantalla, así que el primer dígito
      // recibe el foco inicial en su lugar.
      if (isTV) {
        focusElementSafe(rootRef.current?.querySelector('.parental-pin-digit'));
      } else {
        focusElementSafe(pinInputRef.current);
      }
    }, 0);
    return () => clearTimeout(tm);
  }, [open, isTV]);

  // Algunos remotos reportan OK con un keyCode no estándar (29443) que el
  // navegador no traduce a un click nativo del botón enfocado: sin esto, ese
  // control específico no podría confirmar nada en este teclado numérico.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const code = e.keyCode || e.which;
      if (code !== 29443) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
        e.preventDefault();
        active.click();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  if (!open) return null;

  const effectiveTitle = title || t('parental.channelBlockedTitle', { defaultValue: 'Canal bloqueado' });
  const effectiveMessage = message || t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para continuar' });

  return (
    <div ref={rootRef} className="parental-pin-overlay" role="dialog" aria-modal="true" aria-label={effectiveTitle}>
      <div className="parental-pin-card">
        <div className="parental-pin-title">{effectiveTitle}</div>
        <div className="parental-pin-message">{effectiveMessage}</div>

        <FocusableInput
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

