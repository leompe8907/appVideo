import { forwardRef } from 'react';

/**
 * Wrapper simple de <input>.
 * Se eliminó completamente la lógica de navegación por foco/control remoto.
 */
export const FocusableInput = forwardRef(function FocusableInput(
  { className = '', ...inputProps },
  ref
) {
  return <input ref={ref} className={className} {...inputProps} />;
});

FocusableInput.displayName = 'FocusableInput';

export default FocusableInput;

