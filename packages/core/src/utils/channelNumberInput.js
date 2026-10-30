/**
 * Número de canal tecleado con el control: junta dígitos y confirma tras una
 * pausa sin teclas, o en cuanto se llega a `maxDigits`.
 */
export function createChannelNumberInput({ timeoutMs, maxDigits, onChange, onCommit }) {
  let buffer = '';
  let timer = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    buffer = '';
    onChange?.('');
  };

  const commit = () => {
    const number = Number(buffer);
    clear();
    onCommit?.(number);
  };

  return {
    push(digit) {
      buffer += String(digit);
      onChange?.(buffer);
      if (timer) clearTimeout(timer);
      timer = null;
      if (buffer.length >= Math.max(1, maxDigits)) commit();
      else timer = setTimeout(commit, timeoutMs);
    },
    cancel() {
      if (buffer || timer) clear();
    },
  };
}
