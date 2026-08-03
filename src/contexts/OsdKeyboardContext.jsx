import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { VirtualKeyboard } from '../components/navigation/VirtualKeyboard';

const OsdKeyboardContext = createContext(null);

export function useOsdKeyboard() {
  const ctx = useContext(OsdKeyboardContext);
  if (!ctx) {
    throw new Error('useOsdKeyboard debe usarse dentro de OsdKeyboardProvider');
  }
  return ctx;
}

export function OsdKeyboardProvider({ children }) {
  const [keyboardState, setKeyboardState] = useState({
    isOpen: false,
    title: '',
    type: 'text',
    mask: false,
    initialValue: '',
  });

  const resolverRef = useRef(null);

  const showKeyboard = useCallback((options = {}) => {
    return new Promise((resolve) => {
      // Si ya había una invocación pendiente (no debería pasar en uso normal, pero evita
      // que esa promesa quede colgada para siempre si algo llama showKeyboard() dos veces).
      if (resolverRef.current) {
        resolverRef.current(null);
      }
      resolverRef.current = resolve;
      setKeyboardState({
        isOpen: true,
        title: options.title || '',
        type: options.type || 'text',
        mask: Boolean(options.mask),
        initialValue: options.initialValue || '',
      });
    });
  }, []);

  const handleConfirm = useCallback((value) => {
    setKeyboardState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setKeyboardState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(null); // retorna null indicando cancelación
      resolverRef.current = null;
    }
  }, []);

  return (
    <OsdKeyboardContext.Provider value={{ showKeyboard }}>
      {children}
      {keyboardState.isOpen && (
        <VirtualKeyboard
          initialValue={keyboardState.initialValue}
          title={keyboardState.title}
          type={keyboardState.type}
          mask={keyboardState.mask}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </OsdKeyboardContext.Provider>
  );
}

export default OsdKeyboardContext;
