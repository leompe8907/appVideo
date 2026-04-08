import { useEffect, useMemo, useRef, useState } from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

export function ParentalPinGate({
  open,
  title = 'Canal bloqueado',
  message = 'Ingresa el PIN para continuar',
  onSubmit,
  onCancel,
}) {
  const { isTV } = useDevice();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const pinInputRef = useRef(null);

  const digits = useMemo(() => ['1','2','3','4','5','6','7','8','9','0'], []);

  const { ref: okRef } = useSpatialNavigation({
    focusKey: 'parental-pin-ok',
    onEnterPress: () => handleSubmit(),
    isFocusable: open,
  });
  const { ref: cancelRef } = useSpatialNavigation({
    focusKey: 'parental-pin-cancel',
    onEnterPress: () => onCancel?.(),
    isFocusable: open,
  });

  const digitRefs = digits.map((d) =>
    useSpatialNavigation({
      focusKey: `parental-pin-digit-${d}`,
      onEnterPress: () => {
        setError('');
        setPin((p) => (p.length >= 6 ? p : `${p}${d}`));
      },
      isFocusable: open,
    })
  );

  const handleSubmit = async () => {
    if (!open) return;
    const value = String(pin || '');
    if (!value) {
      setError('Ingresa el PIN');
      return;
    }
    const ok = await onSubmit?.(value);
    if (!ok) {
      setError('PIN incorrecto');
      setPin('');
      try { pinInputRef.current?.focus?.({ preventScroll: true }); } catch { /* noop */ }
    }
  };

  useEffect(() => {
    if (!open) return;
    setPin('');
    setError('');
    const t = setTimeout(() => {
      try {
        pinInputRef.current?.focus?.({ preventScroll: true });
      } catch { /* noop */ }
    }, 0);
    return () => clearTimeout(t);
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
  }, [open, pin]);

  if (!open) return null;

  return (
    <div className="parental-pin-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="parental-pin-card">
        <div className="parental-pin-title">{title}</div>
        <div className="parental-pin-message">{message}</div>

        <input
          ref={pinInputRef}
          className="parental-pin-input"
          value={pin}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="••••"
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

        <div className="parental-pin-pad" aria-label="Teclado numérico">
          {digits.map((d, idx) => (
            <button
              key={d}
              ref={digitRefs[idx].ref}
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
            ref={okRef}
            type="button"
            className="parental-pin-digit parental-pin-digit--ok"
            onClick={() => handleSubmit()}
          >
            OK
          </button>
        </div>

        <div className="parental-pin-actions">
          <button ref={cancelRef} type="button" className="parental-pin-cancel" onClick={() => onCancel?.()}>
            Cancelar
          </button>
          <button ref={okRef} type="button" className="parental-pin-ok" onClick={() => handleSubmit()}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ParentalPinGate;

