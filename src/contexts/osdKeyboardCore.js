import { createContext, useContext } from 'react';

export const OsdKeyboardContext = createContext(null);

export function useOsdKeyboard() {
  const ctx = useContext(OsdKeyboardContext);
  if (!ctx) {
    throw new Error('useOsdKeyboard debe usarse dentro de OsdKeyboardProvider');
  }
  return ctx;
}
