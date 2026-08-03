import { forwardRef, useRef } from 'react';
import { useDevice } from '../../contexts/DeviceContext';
import { useOsdKeyboard } from '../../contexts/OsdKeyboardContext';

/**
 * Wrapper de <input> para TV y Web.
 * En TV, desactiva la edición directa nativa para evitar que se abra el teclado virtual del OS (IME).
 * Al presionar ENTER, abre el teclado virtual OSD personalizado con soporte multi-idioma.
 */
export const FocusableInput = forwardRef(function FocusableInput(
  { className = '', enableOsdKeyboard = true, title = '', ...inputProps },
  ref
) {
  const { isTV } = useDevice();
  const { showKeyboard } = useOsdKeyboard();
  const innerRef = useRef(null);

  const setRefs = (el) => {
    innerRef.current = el;
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(el);
    } else {
      ref.current = el;
    }
  };

  const commitInputValue = (val) => {
    const el = innerRef.current;
    if (!el) return;
    const next = String(val ?? '');

    if (typeof inputProps.onChange === 'function') {
      inputProps.onChange({
        target: { value: next, name: el.name ?? inputProps.name ?? '' },
        currentTarget: el,
      });
      return;
    }

    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (err) {
      console.error('[FocusableInput] Error al establecer valor:', err);
    }
  };

  const onKeyDown = (e) => {
    inputProps.onKeyDown?.(e);
    if (!isTV || !enableOsdKeyboard) return;
    if (inputProps.disabled || inputProps.readOnly) return;

    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();

      const el = innerRef.current;
      if (!el) return;

      // Quitar foco del input para evitar glitches de dibujado del cursor
      el.blur();

      // Abrir el teclado virtual OSD asíncrono.
      // `type` decide qué GRILLA mostrar (numeric tiene prioridad: PIN numérico usa el
      // teclado 4x3 aunque el input además sea type="password"). `mask` es independiente:
      // decide si el preview se enmascara con •, y se basa en el `type` real del input,
      // no en el que termina usando la grilla — así un PIN numérico enmascarado sigue
      // viéndose enmascarado (antes se perdía la máscara por completo en ese caso).
      showKeyboard({
        title: title || inputProps.placeholder || '',
        type: inputProps.inputMode === 'numeric' ? 'numeric' : (inputProps.type || 'text'),
        mask: inputProps.type === 'password',
        initialValue: el.value || '',
      }).then((result) => {
        if (result !== null) {
          commitInputValue(result);
        }
        // Restaurar foco al input después de cerrar
        requestAnimationFrame(() => {
          try {
            el.focus({ preventScroll: true });
          } catch {
            // noop
          }
        });
      });
    }
  };

  const mergedProps = {
    ...inputProps,
    // En TV forzamos readOnly para que el navegador no abra el teclado nativo (IME) al recibir foco
    readOnly: isTV ? true : inputProps.readOnly,
    onKeyDown,
  };

  return <input ref={setRefs} className={className} {...mergedProps} />;
});

FocusableInput.displayName = 'FocusableInput';

export default FocusableInput;
