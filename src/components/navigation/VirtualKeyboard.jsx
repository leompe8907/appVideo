import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/_virtual-keyboard.scss';

// Layouts de letras por idioma soportado (es/en/pt — los únicos que registra i18n.js).
const LAYOUTS = {
  en: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '-'],
  ],
  es: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.', '_'],
  ],
  pt: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.', '_'],
  ],
};

// Mismo "shape" 4x10 que LAYOUTS a propósito: así la navegación por fila/columna
// (ver handleKeyDown) no necesita saber si está mostrando letras o símbolos.
const SYMBOL_LAYOUT = [
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '=', '+', '[', ']', '{', '}', '/', '\\'],
  [':', ';', '"', "'", '<', '>', ',', '.', '?', '|'],
  ['~', '`', '€', '£', '¥', '§', '°', '«', '»', '…'],
];

const NUMERIC_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CANCEL', '0', 'OK'],
];

// Orden de la fila de acciones (navegación LEFT/RIGHT). "symbols" alterna letras↔símbolos.
// "clearall" (borrar todo) vive acá en vez de ser un botón flotante aparte — así queda
// alcanzable por control remoto, que antes era imposible (solo tenía onClick de mouse).
const ACTIONS = ['symbols', 'shift', 'space', 'left', 'right', 'backspace', 'clearall', 'cancel', 'ok'];

// Columna (0-9) de la última fila de letras/símbolos que cae sobre cada acción al bajar,
// y a la inversa (acción -> columna) al subir. 10 columnas repartidas entre 9 acciones.
const ACTION_DOWN_COL_MAP = [
  [0, 'symbols'],
  [1, 'shift'],
  [2, 'space'], [3, 'space'],
  [4, 'left'],
  [5, 'right'],
  [6, 'backspace'],
  [7, 'clearall'],
  [8, 'cancel'],
  [9, 'ok'],
];
const ACTION_UP_COL = {
  symbols: 0,
  shift: 1,
  space: 2,
  left: 4,
  right: 5,
  backspace: 6,
  clearall: 7,
  cancel: 8,
  ok: 9,
};

const DEFAULT_LAYOUT_LANG = 'en';

function resolveLayoutLanguage(language) {
  const code = (language || DEFAULT_LAYOUT_LANG).slice(0, 2).toLowerCase();
  return LAYOUTS[code] ? code : DEFAULT_LAYOUT_LANG;
}

// Parsea el id de una tecla (asignado en el render) a una descripción de acción.
// Único punto de verdad, usado tanto por teclado (Enter) como por click/foco (mouse/touch).
function parseKeyId(id) {
  if (!id) return null;
  let m = id.match(/^key-num-(\d+)-(\d+)$/);
  if (m) return { kind: 'num', row: Number(m[1]), col: Number(m[2]) };
  m = id.match(/^key-char-(\d+)-(\d+)$/);
  if (m) return { kind: 'char', row: Number(m[1]), col: Number(m[2]) };
  m = id.match(/^key-action-(.+)$/);
  if (m) return { kind: 'action', action: m[1] };
  return null;
}

// Botón de tecla memoizado: props siempre primitivas (id/label/className), así que al
// tipear (cambia solo `value`/`cursorPosition` del padre) React puede saltarse por completo
// el re-render de las ~45 teclas — antes se recreaban todas en cada pulsación.
const KeyButton = memo(function KeyButton({ id, label, className, ariaLabel }) {
  return (
    <button id={id} className={className} tabIndex={0} aria-label={ariaLabel}>
      {label}
    </button>
  );
});

export function VirtualKeyboard({
  initialValue = '',
  title = '',
  type = 'text',
  mask = false,
  onConfirm,
  onCancel,
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [cursorPosition, setCursorPosition] = useState(initialValue.length);
  const [layoutLanguage, setLayoutLanguage] = useState(() => resolveLayoutLanguage(i18n.language));
  const [isUppercase, setIsUppercase] = useState(false);
  const [mode, setMode] = useState('letters'); // 'letters' | 'symbols'

  const isNumericMode = type === 'numeric';
  const isMasked = mask || type === 'password';

  // Coordenadas en Ref local (DOM puro, sin pasar por estado/re-render de React).
  const coordsRef = useRef({ row: 0, col: 0, actionKey: 'space' });
  const containerRef = useRef(null);

  useEffect(() => {
    if (isNumericMode) {
      coordsRef.current.row = 0;
      coordsRef.current.col = 0;
      return;
    }
    setLayoutLanguage(resolveLayoutLanguage(i18n.language));
  }, [i18n.language, isNumericMode]);

  useEffect(() => {
    const handleGlobalBack = (e) => {
      const key = e.key || e.code;
      const keyCode = e.keyCode || e.which;
      const isTvBackCodes = keyCode === 10009 || keyCode === 461;

      if (key === 'Escape' || isTvBackCodes) {
        e.preventDefault();
        e.stopPropagation();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleGlobalBack, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalBack, { capture: true });
  }, [onCancel]);

  // Forzar foco en el primer elemento al montar o al cambiar de layout/idioma.
  useEffect(() => {
    const tId = setTimeout(() => {
      const { row, col, actionKey } = coordsRef.current;
      let targetId = '';
      if (isNumericMode) {
        targetId = `key-num-${row}-${col}`;
      } else if (row === 4) {
        targetId = `key-action-${actionKey}`;
      } else {
        targetId = `key-char-${row}-${col}`;
      }
      const el = document.getElementById(targetId);
      if (el) {
        try {
          el.focus({ preventScroll: true });
        } catch {
          // noop
        }
      }
    }, 100);
    return () => clearTimeout(tId);
  }, [layoutLanguage, isUppercase, isNumericMode]);

  const currentLetterLayout = LAYOUTS[layoutLanguage] || LAYOUTS[DEFAULT_LAYOUT_LANG];
  const activeLayout = mode === 'symbols' ? SYMBOL_LAYOUT : currentLetterLayout;

  const handleCharPress = useCallback(
    (char) => {
      const nextChar = isUppercase ? char.toUpperCase() : char.toLowerCase();
      setValue((prev) => prev.slice(0, cursorPosition) + nextChar + prev.slice(cursorPosition));
      setCursorPosition((prev) => prev + 1);
    },
    [isUppercase, cursorPosition]
  );

  const handleActionPress = useCallback(
    (action) => {
      if (action === 'shift') {
        setIsUppercase((prev) => !prev);
      } else if (action === 'symbols') {
        setMode((prev) => (prev === 'symbols' ? 'letters' : 'symbols'));
      } else if (action === 'clearall') {
        if (!value) return;
        setValue('');
        setCursorPosition(0);
      } else if (action === 'space') {
        setValue((prev) => prev.slice(0, cursorPosition) + ' ' + prev.slice(cursorPosition));
        setCursorPosition((prev) => prev + 1);
      } else if (action === 'backspace') {
        setCursorPosition((prevPos) => {
          if (prevPos <= 0) return prevPos;
          setValue((prev) => prev.slice(0, prevPos - 1) + prev.slice(prevPos));
          return prevPos - 1;
        });
      } else if (action === 'left') {
        setCursorPosition((prev) => Math.max(0, prev - 1));
      } else if (action === 'right') {
        setCursorPosition((prev) => Math.min(value.length, prev + 1));
      } else if (action === 'cancel') {
        onCancel?.();
      } else if (action === 'ok') {
        onConfirm?.(value);
      }
    },
    [cursorPosition, value, onCancel, onConfirm]
  );

  // Activa lo que representa un id de tecla ya parseado — único punto de disparo,
  // usado por Enter (control remoto) y por click/tap (mouse, touch, "OK" del remoto sobre foco).
  const activateParsed = useCallback(
    (parsed) => {
      if (!parsed) return;
      if (parsed.kind === 'num') {
        const label = NUMERIC_LAYOUT[parsed.row][parsed.col];
        if (label === 'CANCEL') onCancel?.();
        else if (label === 'OK') onConfirm?.(value);
        else {
          setValue((prev) => prev.slice(0, cursorPosition) + label + prev.slice(cursorPosition));
          setCursorPosition((prev) => prev + 1);
        }
      } else if (parsed.kind === 'char') {
        const char = activeLayout[parsed.row]?.[parsed.col];
        if (char != null) handleCharPress(char);
      } else if (parsed.kind === 'action') {
        handleActionPress(parsed.action);
      }
    },
    [activeLayout, cursorPosition, value, onCancel, onConfirm, handleCharPress, handleActionPress]
  );

  const syncCoordsFromParsed = useCallback((parsed) => {
    if (!parsed) return;
    if (parsed.kind === 'action') {
      coordsRef.current = { row: 4, col: coordsRef.current.col, actionKey: parsed.action };
    } else {
      coordsRef.current = { row: parsed.row, col: parsed.col, actionKey: coordsRef.current.actionKey };
    }
  }, []);

  // Delegación: un solo listener de click/foco por grilla en vez de uno por tecla
  // (evita recrear ~45 closures en cada render mientras se tipea).
  const handleGridFocus = useCallback(
    (e) => {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      syncCoordsFromParsed(parseKeyId(btn.id));
    },
    [syncCoordsFromParsed]
  );

  const handleGridClick = useCallback(
    (e) => {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      const parsed = parseKeyId(btn.id);
      syncCoordsFromParsed(parsed);
      activateParsed(parsed);
    },
    [syncCoordsFromParsed, activateParsed]
  );

  const handleKeyDown = (e) => {
    const key = e.key || e.code;
    const keyCode = e.keyCode || e.which;

    const isTvBackCodes = keyCode === 10009 || keyCode === 461;
    if (key === 'Escape' || (key === 'Backspace' && value.length === 0) || isTvBackCodes) {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
      return;
    }

    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) return;

    syncCoordsFromParsed(parseKeyId(active.id));

    let { row, col, actionKey } = coordsRef.current;
    let nextRow = row;
    let nextCol = col;
    let nextAction = actionKey;

    if (isNumericMode) {
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (col < 2) nextCol = col + 1;
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (col > 0) nextCol = col - 1;
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (row < 3) nextRow = row + 1;
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (row > 0) nextRow = row - 1;
      } else if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        activateParsed({ kind: 'num', row, col });
      }
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      if (row === 4) {
        const idx = ACTIONS.indexOf(actionKey);
        if (idx >= 0 && idx < ACTIONS.length - 1) nextAction = ACTIONS[idx + 1];
      } else if (col < 9) {
        nextCol = col + 1;
      }
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      if (row === 4) {
        const idx = ACTIONS.indexOf(actionKey);
        if (idx > 0) nextAction = ACTIONS[idx - 1];
      } else if (col > 0) {
        nextCol = col - 1;
      }
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (row < 3) {
        nextRow = row + 1;
      } else if (row === 3) {
        nextRow = 4;
        const found = ACTION_DOWN_COL_MAP.find(([c]) => c === col);
        nextAction = found ? found[1] : 'ok';
      }
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (row === 4) {
        nextRow = 3;
        nextCol = ACTION_UP_COL[actionKey] ?? 9;
      } else if (row > 0) {
        nextRow = row - 1;
      }
    } else if (key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (row === 4) {
        activateParsed({ kind: 'action', action: actionKey });
      } else {
        activateParsed({ kind: 'char', row, col });
      }
    }

    coordsRef.current = { row: nextRow, col: nextCol, actionKey: nextAction };

    let targetId = '';
    if (isNumericMode) {
      targetId = `key-num-${nextRow}-${nextCol}`;
    } else if (nextRow === 4) {
      targetId = `key-action-${nextAction}`;
    } else {
      targetId = `key-char-${nextRow}-${nextCol}`;
    }

    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      try {
        targetEl.focus({ preventScroll: true });
      } catch {
        // noop
      }
    }
  };

  const previewBefore = value.slice(0, cursorPosition);
  const previewAfter = value.slice(cursorPosition);

  return (
    <div
      ref={containerRef}
      className={`osd-keyboard-container ${isNumericMode ? 'osd-keyboard-container--numeric' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={title || t('keyboard.title', { defaultValue: 'Teclado Virtual' })}
    >
      <div className={`osd-keyboard-box ${isNumericMode ? 'osd-keyboard-box--numeric' : ''}`}>
        {title && <div className="osd-keyboard-title">{title}</div>}

        <div className="osd-keyboard-input-preview-wrapper">
          <div className="osd-keyboard-input-preview-custom" aria-live="polite">
            <span>{isMasked ? '•'.repeat(previewBefore.length) : previewBefore}</span>
            <span className="osd-keyboard-caret" />
            <span>{isMasked ? '•'.repeat(previewAfter.length) : previewAfter}</span>
          </div>
        </div>

        {isNumericMode ? (
          <div className="osd-keyboard-grid osd-keyboard-grid--numeric" onFocus={handleGridFocus} onClick={handleGridClick}>
            {NUMERIC_LAYOUT.map((row, rIdx) => (
              <div key={rIdx} className="osd-keyboard-row">
                {row.map((btnLabel, cIdx) => {
                  let keyClass = 'osd-keyboard-key osd-keyboard-key--num';
                  if (btnLabel === 'CANCEL') keyClass += ' osd-keyboard-key--cancel';
                  if (btnLabel === 'OK') keyClass += ' osd-keyboard-key--ok';
                  const label =
                    btnLabel === 'CANCEL' ? t('keyboard.cancel', { defaultValue: 'Cancelar' }) : btnLabel;
                  return <KeyButton key={cIdx} id={`key-num-${rIdx}-${cIdx}`} label={label} className={keyClass} />;
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="osd-keyboard-grid" onFocus={handleGridFocus} onClick={handleGridClick}>
            {activeLayout.map((row, rIdx) => (
              <div key={rIdx} className="osd-keyboard-row">
                {row.map((char, cIdx) => {
                  const displayChar = mode === 'symbols' ? char : isUppercase ? char.toUpperCase() : char.toLowerCase();
                  return (
                    <KeyButton
                      key={cIdx}
                      id={`key-char-${rIdx}-${cIdx}`}
                      label={displayChar}
                      className="osd-keyboard-key"
                    />
                  );
                })}
              </div>
            ))}

            <div className="osd-keyboard-row osd-keyboard-row--actions">
              <KeyButton
                id="key-action-symbols"
                label={mode === 'symbols' ? t('keyboard.letters', { defaultValue: 'ABC' }) : t('keyboard.symbols', { defaultValue: '#+=' })}
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--symbols"
              />
              <KeyButton
                id="key-action-shift"
                label={`⇧ ${t('keyboard.shift', { defaultValue: 'Mayús' })}`}
                className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--shift${
                  isUppercase ? ' osd-keyboard-key--action-active' : ''
                }`}
              />
              <KeyButton
                id="key-action-space"
                label={`[ ${t('keyboard.space', { defaultValue: 'Espacio' })} ]`}
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--space"
              />
              <KeyButton
                id="key-action-left"
                label="◄"
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--arrow"
              />
              <KeyButton
                id="key-action-right"
                label="►"
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--arrow"
              />
              <KeyButton
                id="key-action-backspace"
                label={`⌫ ${t('keyboard.delete', { defaultValue: 'Borrar' })}`}
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--backspace"
              />
              <KeyButton
                id="key-action-clearall"
                label={`× ${t('keyboard.clearAllShort', { defaultValue: 'Todo' })}`}
                ariaLabel={t('keyboard.clearAll', { defaultValue: 'Borrar todo' })}
                className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--clearall${
                  value.length === 0 ? ' osd-keyboard-key--action-disabled' : ''
                }`}
              />
              <KeyButton
                id="key-action-cancel"
                label={t('keyboard.cancel', { defaultValue: 'Cancelar' })}
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--cancel"
              />
              <KeyButton
                id="key-action-ok"
                label={t('keyboard.confirm', { defaultValue: 'OK' })}
                className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--ok"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualKeyboard;
