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
  const isEditingRef = useRef(false);

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
    isEditingRef.current = false;
  }, [isTV]);

  const onKeyDown = (e) => {
    inputProps.onKeyDown?.(e);
    if (!isTV) return;
    if (inputProps.disabled) return;
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();

      if (isEditingRef.current) {
        // Ya estaba editando → salir de edición, cerrar teclado virtual.
        setIsEditing(false);
        isEditingRef.current = false;
        requestAnimationFrame(() => {
          const el = innerRef.current;
          if (!el) return;
          try {
            el.readOnly = true;
            el.blur();
          } catch {
            // noop
          }
        });
      } else {
        // No estaba editando → entrar en edición, abrir IME.
        setIsEditing(true);
        isEditingRef.current = true;
        requestAnimationFrame(() => {
          const el = innerRef.current;
          if (!el) return;
          try {
            el.readOnly = false;
            el.focus({ preventScroll: true });
            el.click?.();
            if (typeof el.value === 'string') {
              const len = el.value.length;
              el.setSelectionRange?.(len, len);
            }
          } catch {
            // noop
          }
        });
      }
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
    setIsEditing(false);
    isEditingRef.current = false;
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

