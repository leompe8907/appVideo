import { forwardRef, useEffect, useRef, useState } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

/**
 * Wrapper simple de <input>.
 * Se eliminó completamente la lógica de navegación por foco/control remoto.
 */
export const FocusableInput = forwardRef(function FocusableInput(
  { className = '', ...inputProps },
  ref
) {
  const { isTV } = useDevice();
  const innerRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  const setRefs = (el) => {
    innerRef.current = el;
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(el);
    } else {
      ref.current = el;
    }
  };

  // TV: permitir navegar con foco REAL en input, pero sin abrir IME hasta que el usuario presione ENTER.
  // Estrategia: mantener readOnly mientras NO estamos editando; en ENTER habilitamos edición.
  useEffect(() => {
    if (!isTV) return;
    setIsEditing(false);
  }, [isTV]);

  const onKeyDown = (e) => {
    inputProps.onKeyDown?.(e);
    if (!isTV) return;
    if (e.defaultPrevented) return;
    if (inputProps.disabled) return;
    if (e.key === 'Enter' || e.keyCode === 13) {
      // Pasar a modo edición y re-enfocar para forzar IME.
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(true);
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        try {
          el.readOnly = false;
          el.focus({ preventScroll: true });
          el.click?.();
          // Llevar caret al final (opcional, suele ser lo esperado en TV).
          if (typeof el.value === 'string') {
            const len = el.value.length;
            el.setSelectionRange?.(len, len);
          }
        } catch {
          // noop
        }
      });
    }
  };

  const onFocus = (e) => {
    inputProps.onFocus?.(e);
    if (!isTV) return;
    // Mientras no esté editando, asegurar que no dispare teclado.
    try {
      if (!isEditing && innerRef.current) innerRef.current.readOnly = true;
    } catch {
      // noop
    }
  };

  const onBlur = (e) => {
    inputProps.onBlur?.(e);
    if (!isTV) return;
    // Al salir del input volvemos a modo navegación (readOnly).
    setIsEditing(false);
    try {
      if (innerRef.current) innerRef.current.readOnly = true;
    } catch {
      // noop
    }
  };

  const mergedProps = {
    ...inputProps,
    // Solo TV: navegable sin IME hasta ENTER
    readOnly: isTV ? !isEditing : inputProps.readOnly,
    onKeyDown,
    onFocus,
    onBlur,
  };

  return <input ref={setRefs} className={className} {...mergedProps} />;
});

FocusableInput.displayName = 'FocusableInput';

export default FocusableInput;

