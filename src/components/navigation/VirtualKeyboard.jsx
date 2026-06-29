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

const LANG_LABELS = {
  en: 'ENG',
  es: 'ESP',
  pt: 'POR',
  bg: 'БГ'
};

export function VirtualKeyboard({
  initialValue = '',
  title = '',
  type = 'text',
  onConfirm,
  onCancel
}) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [layoutLanguage, setLayoutLanguage] = useState('es');
  const [isUppercase, setIsUppercase] = useState(false);

  const isNumericMode = type === 'numeric';

  // Foco matricial
  const [activeRow, setActiveRow] = useState(0); 
  const [activeCol, setActiveCol] = useState(0);
  const [activeActionKey, setActiveActionKey] = useState('space'); // shift, space, backspace, cancel, ok
  const [activeLangIndex, setActiveLangIndex] = useState(0);

  const containerRef = useRef(null);

  // Inicializar idioma por defecto del teclado según el idioma de la app
  useEffect(() => {
    if (isNumericMode) {
      setActiveRow(0);
      setActiveCol(0);
      return;
    }
    const appLang = (i18n.language || 'es').slice(0, 2);
    if (LAYOUTS[appLang]) {
      setLayoutLanguage(appLang);
      setActiveLangIndex(Object.keys(LAYOUTS).indexOf(appLang));
    } else {
      setLayoutLanguage('es');
      setActiveLangIndex(Object.keys(LAYOUTS).indexOf('es'));
    }
  }, [i18n.language, isNumericMode]);

  // Forzar foco en el contenedor del teclado para interceptar teclas
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Sincronizar el foco visual del DOM según la fila/columna activa
  useEffect(() => {
    let targetId = '';
    if (isNumericMode) {
      targetId = `key-num-${activeRow}-${activeCol}`;
    } else {
      if (activeRow === -1) {
        targetId = `key-lang-${activeLangIndex}`;
      } else if (activeRow === 4) {
        targetId = `key-action-${activeActionKey}`;
      } else {
        targetId = `key-char-${activeRow}-${activeCol}`;
      }
    }

    const el = document.getElementById(targetId);
    if (el) {
      try {
        el.focus({ preventScroll: true });
      } catch {
        // noop
      }
    }
  }, [activeRow, activeCol, activeActionKey, activeLangIndex, isNumericMode]);

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

  const handleLangPress = (lang) => {
    setLayoutLanguage(lang);
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

    let nextRow = activeRow;
    let nextCol = activeCol;
    let nextLangIdx = activeLangIndex;
    let nextAction = activeActionKey;

    const languages = Object.keys(LAYOUTS);

    if (isNumericMode) {
      // Navegación matricial 4x3 para teclado numérico
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (activeCol < 2) nextCol = activeCol + 1;
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (activeCol > 0) nextCol = activeCol - 1;
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow < 3) nextRow = activeRow + 1;
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow > 0) nextRow = activeRow - 1;
      } else if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const numKey = NUMERIC_LAYOUT[activeRow][activeCol];
        if (numKey === 'CANCEL') {
          onCancel?.();
        } else if (numKey === 'OK') {
          onConfirm?.(value);
        } else {
          // Es un número
          setValue((prev) => prev + numKey);
        }
      }
    } else {
      // Teclado completo QWERTY
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow === -1) {
          if (activeLangIndex < languages.length - 1) {
            nextLangIdx = activeLangIndex + 1;
          }
        } else if (activeRow === 4) {
          const actions = ['shift', 'space', 'backspace', 'cancel', 'ok'];
          const currentIdx = actions.indexOf(activeActionKey);
          if (currentIdx < actions.length - 1) {
            nextAction = actions[currentIdx + 1];
          }
        } else {
          if (activeCol < 9) {
            nextCol = activeCol + 1;
          }
        }
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow === -1) {
          if (activeLangIndex > 0) {
            nextLangIdx = activeLangIndex - 1;
          }
        } else if (activeRow === 4) {
          const actions = ['shift', 'space', 'backspace', 'cancel', 'ok'];
          const currentIdx = actions.indexOf(activeActionKey);
          if (currentIdx > 0) {
            nextAction = actions[currentIdx - 1];
          }
        } else {
          if (activeCol > 0) {
            nextCol = activeCol - 1;
          }
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow === -1) {
          nextRow = 0;
          nextCol = Math.min(activeLangIndex * 2, 9);
        } else if (activeRow < 3) {
          nextRow = activeRow + 1;
        } else if (activeRow === 3) {
          nextRow = 4;
          if (activeCol <= 1) nextAction = 'shift';
          else if (activeCol <= 4) nextAction = 'space';
          else if (activeCol <= 6) nextAction = 'backspace';
          else if (activeCol <= 8) nextAction = 'cancel';
          else nextAction = 'ok';
        }
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow === 4) {
          nextRow = 3;
          if (activeActionKey === 'shift') nextCol = 1;
          else if (activeActionKey === 'space') nextCol = 3;
          else if (activeActionKey === 'backspace') nextCol = 6;
          else if (activeActionKey === 'cancel') nextCol = 8;
          else nextCol = 9;
        } else if (activeRow > 0) {
          nextRow = activeRow - 1;
        } else if (activeRow === 0) {
          nextRow = -1;
          nextLangIdx = Math.min(Math.floor(activeCol / 2), languages.length - 1);
        }
      } else if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeRow === -1) {
          handleLangPress(languages[activeLangIndex]);
        } else if (activeRow === 4) {
          handleActionPress(activeActionKey);
        } else {
          handleCharPress(LAYOUTS[layoutLanguage][activeRow][activeCol]);
        }
      }
    }

    setActiveRow(nextRow);
    setActiveCol(nextCol);
    setActiveLangIndex(nextLangIdx);
    setActiveActionKey(nextAction);
  };

  const currentLayout = LAYOUTS[layoutLanguage] || LAYOUTS.es;

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
                  const isFocused = activeRow === rIdx && activeCol === cIdx;
                  let keyClass = 'osd-keyboard-key osd-keyboard-key--num';
                  if (isFocused) keyClass += ' osd-keyboard-key--focused';
                  if (btnLabel === 'CANCEL') keyClass += ' osd-keyboard-key--cancel';
                  if (btnLabel === 'OK') keyClass += ' osd-keyboard-key--ok';

                  return (
                    <button
                      id={`key-num-${rIdx}-${cIdx}`}
                      key={cIdx}
                      className={keyClass}
                      onClick={() => {
                        setActiveRow(rIdx);
                        setActiveCol(cIdx);
                        if (btnLabel === 'CANCEL') {
                          onCancel?.();
                        } else if (btnLabel === 'OK') {
                          onConfirm?.(value);
                        } else {
                          setValue((prev) => prev + btnLabel);
                        }
                      }}
                      tabIndex={-1}
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
          <>
            {/* Language Tabs */}
            <div className="osd-keyboard-lang-selector">
              {Object.keys(LAYOUTS).map((lang, idx) => (
                <button
                  id={`key-lang-${idx}`}
                  key={lang}
                  className={`osd-keyboard-lang-btn ${
                    layoutLanguage === lang ? 'osd-keyboard-lang-btn--active' : ''
                  }`}
                  onClick={() => {
                    handleLangPress(lang);
                    setActiveLangIndex(idx);
                    setActiveRow(-1);
                  }}
                  tabIndex={-1}
                >
                  {LANG_LABELS[lang]}
                </button>
              ))}
            </div>

            <div className="osd-keyboard-grid">
              {currentLayout.map((row, rIdx) => (
                <div key={rIdx} className="osd-keyboard-row">
                  {row.map((char, cIdx) => {
                    const displayChar = isUppercase ? char.toUpperCase() : char.toLowerCase();
                    const isFocused = activeRow === rIdx && activeCol === cIdx;
                    return (
                      <button
                        id={`key-char-${rIdx}-${cIdx}`}
                        key={cIdx}
                        className={`osd-keyboard-key ${isFocused ? 'osd-keyboard-key--focused' : ''}`}
                        onClick={() => {
                          handleCharPress(char);
                          setActiveRow(rIdx);
                          setActiveCol(cIdx);
                        }}
                        tabIndex={-1}
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
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--shift ${
                    activeRow === 4 && activeActionKey === 'shift' ? 'osd-keyboard-key--focused' : ''
                  } ${isUppercase ? 'osd-keyboard-key--action-active' : ''}`}
                  onClick={() => {
                    handleActionPress('shift');
                    setActiveRow(4);
                    setActiveActionKey('shift');
                  }}
                  tabIndex={-1}
                >
                  ⇧ {t('keyboard.shift', { defaultValue: 'Mayús' })}
                </button>

                <button
                  id="key-action-space"
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--space ${
                    activeRow === 4 && activeActionKey === 'space' ? 'osd-keyboard-key--focused' : ''
                  }`}
                  onClick={() => {
                    handleActionPress('space');
                    setActiveRow(4);
                    setActiveActionKey('space');
                  }}
                  tabIndex={-1}
                >
                  [ {t('keyboard.space', { defaultValue: 'Espacio' })} ]
                </button>

                <button
                  id="key-action-backspace"
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--backspace ${
                    activeRow === 4 && activeActionKey === 'backspace' ? 'osd-keyboard-key--focused' : ''
                  }`}
                  onClick={() => {
                    handleActionPress('backspace');
                    setActiveRow(4);
                    setActiveActionKey('backspace');
                  }}
                  tabIndex={-1}
                >
                  ⌫ {t('keyboard.delete', { defaultValue: 'Borrar' })}
                </button>

                <button
                  id="key-action-cancel"
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--cancel ${
                    activeRow === 4 && activeActionKey === 'cancel' ? 'osd-keyboard-key--focused' : ''
                  }`}
                  onClick={() => {
                    handleActionPress('cancel');
                    setActiveRow(4);
                    setActiveActionKey('cancel');
                  }}
                  tabIndex={-1}
                >
                  {t('keyboard.cancel', { defaultValue: 'Cancelar' })}
                </button>

                <button
                  id="key-action-ok"
                  className={`osd-keyboard-key osd-keyboard-key--action osd-keyboard-key--ok ${
                    activeRow === 4 && activeActionKey === 'ok' ? 'osd-keyboard-key--focused' : ''
                  }`}
                  onClick={() => {
                    handleActionPress('ok');
                    setActiveRow(4);
                    setActiveActionKey('ok');
                  }}
                  tabIndex={-1}
                >
                  {t('keyboard.confirm', { defaultValue: 'OK' })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default VirtualKeyboard;
