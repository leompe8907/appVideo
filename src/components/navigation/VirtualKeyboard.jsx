import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/_virtual-keyboard.scss';

const LAYOUTS = {
  en: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '@'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '-']
  ],
  es: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.', '_']
  ],
  pt: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', '@', '.', '_']
  ],
  bg: [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['я', 'в', 'е', 'р', 'т', 'ъ', 'у', 'и', 'о', 'п'],
    ['а', 'с', 'д', 'ф', 'г', 'х', 'й', 'к', 'л', 'ш'],
    ['з', 'ь', 'ц', 'ж', 'б', 'н', 'м', 'ч', 'ю', 'щ']
  ]
};

const NUMERIC_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CANCEL', '0', 'OK']
];

const DEFAULT_LAYOUT_LANG = 'en';

function resolveLayoutLanguage(language) {
  const code = (language || DEFAULT_LAYOUT_LANG).slice(0, 2).toLowerCase();
  return LAYOUTS[code] ? code : DEFAULT_LAYOUT_LANG;
}

export function VirtualKeyboard({
  initialValue = '',
  title = '',
  type = 'text',
  onConfirm,
  onCancel
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [layoutLanguage, setLayoutLanguage] = useState(() => resolveLayoutLanguage(i18n.language));
  const [isUppercase, setIsUppercase] = useState(false);

  const isNumericMode = type === 'numeric';

  // Coordenadas en Ref local (DOM puro, 0ms render lag)
  const coordsRef = useRef({
    row: 0,
    col: 0,
    actionKey: 'space',
  });

  const containerRef = useRef(null);

  // Sincronizar layout con el idioma de la app (TV); fallback a inglés si no hay teclado
  useEffect(() => {
    if (isNumericMode) {
      coordsRef.current.row = 0;
      coordsRef.current.col = 0;
      return;
    }
    setLayoutLanguage(resolveLayoutLanguage(i18n.language));
  }, [i18n.language, isNumericMode]);

  // Forzar foco en el primer elemento al montar o al cambiar de layout
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

  const handleCharPress = (char) => {
    setValue((prev) => {
      const nextChar = isUppercase ? char.toUpperCase() : char.toLowerCase();
      return prev + nextChar;
    });
  };

  const handleActionPress = (action) => {
    if (action === 'shift') {
      setIsUppercase((prev) => !prev);
    } else if (action === 'space') {
      setValue((prev) => prev + ' ');
    } else if (action === 'backspace') {
      setValue((prev) => prev.slice(0, -1));
    } else if (action === 'cancel') {
      onCancel?.();
    } else if (action === 'ok') {
      onConfirm?.(value);
    }
  };

  const handleKeyDown = (e) => {
    const key = e.key || e.code;
    const keyCode = e.keyCode || e.which;

    // Manejar tecla BACK nativa de TV
    const isTvBackCodes = keyCode === 10009 || keyCode === 461;
    if (key === 'Escape' || key === 'Backspace' && value.length === 0 || isTvBackCodes) {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
      return;
    }

    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) return;

    let row = coordsRef.current.row;
    let col = coordsRef.current.col;
    let actionKey = coordsRef.current.actionKey;

    // Auto-detectar posición actual desde el ID del elemento enfocado
    if (active.id.startsWith('key-num-')) {
      const match = active.id.match(/^key-num-(\d+)-(\d+)$/);
      if (match) {
        row = parseInt(match[1], 10);
        col = parseInt(match[2], 10);
      }
    } else if (active.id.startsWith('key-char-')) {
      const match = active.id.match(/^key-char-(\d+)-(\d+)$/);
      if (match) {
        row = parseInt(match[1], 10);
        col = parseInt(match[2], 10);
      }
    } else if (active.id.startsWith('key-action-')) {
      const match = active.id.match(/^key-action-(.+)$/);
      if (match) {
        row = 4;
        actionKey = match[1];
      }
    }

    let nextRow = row;
    let nextCol = col;
    let nextAction = actionKey;

    if (isNumericMode) {
      // Navegación matricial 4x3 para teclado numérico
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
        const numKey = NUMERIC_LAYOUT[row][col];
        if (numKey === 'CANCEL') {
          onCancel?.();
        } else if (numKey === 'OK') {
          onConfirm?.(value);
        } else {
          setValue((prev) => prev + numKey);
        }
      }
    } else {
      // Teclado completo QWERTY
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (row === 4) {
          const actions = ['shift', 'space', 'backspace', 'cancel', 'ok'];
          const currentIdx = actions.indexOf(actionKey);
          if (currentIdx < actions.length - 1) {
            nextAction = actions[currentIdx + 1];
          }
        } else {
          if (col < 9) {
            nextCol = col + 1;
          }
        }
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (row === 4) {
          const actions = ['shift', 'space', 'backspace', 'cancel', 'ok'];
          const currentIdx = actions.indexOf(actionKey);
          if (currentIdx > 0) {
            nextAction = actions[currentIdx - 1];
          }
        } else {
          if (col > 0) {
            nextCol = col - 1;
          }
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (row < 3) {
          nextRow = row + 1;
        } else if (row === 3) {
          nextRow = 4;
          if (col <= 1) nextAction = 'shift';
          else if (col <= 4) nextAction = 'space';
          else if (col <= 6) nextAction = 'backspace';
          else if (col <= 8) nextAction = 'cancel';
          else nextAction = 'ok';
        }
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (row === 4) {
          nextRow = 3;
          if (actionKey === 'shift') nextCol = 1;
          else if (actionKey === 'space') nextCol = 3;
          else if (actionKey === 'backspace') nextCol = 6;
          else if (actionKey === 'cancel') nextCol = 8;
          else nextCol = 9;
        } else if (row > 0) {
          nextRow = row - 1;
        }
      } else if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (row === 4) {
          handleActionPress(actionKey);
        } else {
          handleCharPress(LAYOUTS[layoutLanguage][row][col]);
        }
      }
    }

    // Actualizar coordenadas en Ref
    coordsRef.current = {
      row: nextRow,
      col: nextCol,
      actionKey: nextAction
    };

    // Enfocar directamente a través del DOM sin re-renderizar
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

  const currentLayout = LAYOUTS[layoutLanguage] || LAYOUTS[DEFAULT_LAYOUT_LANG];

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

        {/* Input Preview */}
        <div className="osd-keyboard-input-preview-wrapper">
          <input
            className="osd-keyboard-input-preview"
            type={type === 'password' ? 'password' : 'text'}
            value={value}
            readOnly
          />
          {value.length > 0 && (
            <span
              className="osd-keyboard-clear-preview"
              onClick={() => setValue('')}
            >
              ×
            </span>
          )}
        </div>

        {/* Renderizado de Teclado Numérico */}
        {isNumericMode ? (
          <div className="osd-keyboard-grid osd-keyboard-grid--numeric">
            {NUMERIC_LAYOUT.map((row, rIdx) => (
              <div key={rIdx} className="osd-keyboard-row">
                {row.map((btnLabel, cIdx) => {
                  let keyClass = 'osd-keyboard-key osd-keyboard-key--num';
                  if (btnLabel === 'CANCEL') keyClass += ' osd-keyboard-key--cancel';
                  if (btnLabel === 'OK') keyClass += ' osd-keyboard-key--ok';

                  return (
                    <button
                      id={`key-num-${rIdx}-${cIdx}`}
                      key={cIdx}
                      className={keyClass}
                      onFocus={() => {
                        coordsRef.current.row = rIdx;
                        coordsRef.current.col = cIdx;
                      }}
                      onClick={() => {
                        coordsRef.current.row = rIdx;
                        coordsRef.current.col = cIdx;
                        if (btnLabel === 'CANCEL') {
                          onCancel?.();
                        } else if (btnLabel === 'OK') {
                          onConfirm?.(value);
                        } else {
                          setValue((prev) => prev + btnLabel);
                        }
                      }}
                      tabIndex={0}
                    >
                      {btnLabel === 'CANCEL' ? t('keyboard.cancel', { defaultValue: 'Cancelar' }) : btnLabel}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          /* Renderizado de Teclado QWERTY */
          <div className="osd-keyboard-grid">
              {currentLayout.map((row, rIdx) => (
                <div key={rIdx} className="osd-keyboard-row">
                  {row.map((char, cIdx) => {
                    const displayChar = isUppercase ? char.toUpperCase() : char.toLowerCase();
                    return (
                      <button
                        id={`key-char-${rIdx}-${cIdx}`}
                        key={cIdx}
                        className="osd-keyboard-key"
                        onFocus={() => {
                          coordsRef.current.row = rIdx;
                          coordsRef.current.col = cIdx;
                        }}
                        onClick={() => {
                          handleCharPress(char);
                          coordsRef.current.row = rIdx;
                          coordsRef.current.col = cIdx;
                        }}
                        tabIndex={0}
                      >
                        {displayChar}
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Action Row */}
              <div className="osd-keyboard-row osd-keyboard-row--actions">
                <button
                  id="key-action-shift"
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--shift ${isUppercase ? 'osd-keyboard-key--action-active' : ''}`}
                  onFocus={() => {
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'shift';
                  }}
                  onClick={() => {
                    handleActionPress('shift');
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'shift';
                  }}
                  tabIndex={0}
                >
                  ⇧ {t('keyboard.shift', { defaultValue: 'Mayús' })}
                </button>

                <button
                  id="key-action-space"
                  className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--space"
                  onFocus={() => {
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'space';
                  }}
                  onClick={() => {
                    handleActionPress('space');
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'space';
                  }}
                  tabIndex={0}
                >
                  [ {t('keyboard.space', { defaultValue: 'Espacio' })} ]
                </button>

                <button
                  id="key-action-backspace"
                  className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--backspace"
                  onFocus={() => {
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'backspace';
                  }}
                  onClick={() => {
                    handleActionPress('backspace');
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'backspace';
                  }}
                  tabIndex={0}
                >
                  ⌫ {t('keyboard.delete', { defaultValue: 'Borrar' })}
                </button>

                <button
                  id="key-action-cancel"
                  className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--cancel"
                  onFocus={() => {
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'cancel';
                  }}
                  onClick={() => {
                    handleActionPress('cancel');
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'cancel';
                  }}
                  tabIndex={0}
                >
                  {t('keyboard.cancel', { defaultValue: 'Cancelar' })}
                </button>

                <button
                  id="key-action-ok"
                  className="osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--ok"
                  onFocus={() => {
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'ok';
                  }}
                  onClick={() => {
                    handleActionPress('ok');
                    coordsRef.current.row = 4;
                    coordsRef.current.actionKey = 'ok';
                  }}
                  tabIndex={0}
                >
                  {t('keyboard.confirm', { defaultValue: 'OK' })}
                </button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default VirtualKeyboard;
