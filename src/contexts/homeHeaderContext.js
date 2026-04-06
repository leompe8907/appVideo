import { createContext, useContext } from 'react';

export const HomeHeaderContext = createContext(null);

export function useHomeHeader() {
  const ctx = useContext(HomeHeaderContext);
  if (!ctx) throw new Error('useHomeHeader debe usarse dentro de HomeHeaderProvider');
  return ctx;
}

export default HomeHeaderContext;

