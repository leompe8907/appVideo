// Normalización mínima de input remoto para Smart TV (LG webOS / Samsung Tizen).
// Objetivo: traducir distintos key/keyCode a acciones abstractas (LRUD/ENTER/BACK)
// sin acoplar el resto de la app a detalles por plataforma.

export const TV_ACTION = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  ENTER: 'enter',
  BACK: 'back',
  /** CH+ / Channel Up (10foot: PUP → channelUp) */
  CHANNEL_UP: 'channel_up',
  /** CH− / Channel Down (10foot: PDOWN → channelDown) */
  CHANNEL_DOWN: 'channel_down',
});

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getTvActionFromKeyEvent(e) {
  if (!e) return null;
  const key = String(e.key || '');
  const code = String(e.code || '');
  const keyCode = toInt(e.keyCode || e.which);

  // D-pad
  if (key === 'ArrowUp' || code === 'ArrowUp' || keyCode === 38) return TV_ACTION.UP;
  if (key === 'ArrowDown' || code === 'ArrowDown' || keyCode === 40) return TV_ACTION.DOWN;
  if (key === 'ArrowLeft' || code === 'ArrowLeft' || keyCode === 37) return TV_ACTION.LEFT;
  if (key === 'ArrowRight' || code === 'ArrowRight' || keyCode === 39) return TV_ACTION.RIGHT;

  // OK / Enter
  if (key === 'Enter' || code === 'Enter' || keyCode === 13) return TV_ACTION.ENTER;
  // Algunos remotos reportan Space como OK (casos raros)
  if (key === ' ' || code === 'Space' || keyCode === 32) return TV_ACTION.ENTER;

  // Back/Return
  // Samsung Tizen Back: 10009 (muy común)
  // LG webOS Back: 461 (muy común)
  // También soportar variantes del navegador
  const isReturnLike = key === 'Return' || key === 'GoBack' || key === 'BrowserBack';
  if (key === 'Escape' || code === 'Escape' || keyCode === 27) return TV_ACTION.BACK;
  if (key === 'Backspace' || code === 'Backspace' || keyCode === 8) return TV_ACTION.BACK;
  if (isReturnLike) return TV_ACTION.BACK;
  if (keyCode === 10009 || keyCode === 461) return TV_ACTION.BACK;

  // CH+ / CH− (Tizen 427/428; también nombres estándar en otros TV)
  if (key === 'ChannelUp' || code === 'ChannelUp' || keyCode === 427) return TV_ACTION.CHANNEL_UP;
  if (key === 'ChannelDown' || code === 'ChannelDown' || keyCode === 428) return TV_ACTION.CHANNEL_DOWN;

  return null;
}

export function isTextInputElement(el) {
  if (!el) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  const type = String(el.type || '').toLowerCase();
  // Inputs típicos de login
  return type === 'text' || type === 'password' || type === 'email' || type === 'number' || type === '';
}

/** Input de texto en edición real (no readOnly/disabled). En TV los FocusableInput son readOnly. */
export function isEditableTextInputElement(el) {
  if (!isTextInputElement(el)) return false;
  if (el.readOnly || el.disabled) return false;
  return true;
}

export function getCaretInfo(inputEl) {
  try {
    const v = String(inputEl?.value ?? '');
    const start = toInt(inputEl?.selectionStart);
    const end = toInt(inputEl?.selectionEnd);
    return { value: v, start, end, length: v.length };
  } catch {
    return { value: '', start: 0, end: 0, length: 0 };
  }
}

