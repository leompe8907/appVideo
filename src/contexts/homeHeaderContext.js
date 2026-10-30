import { createContext, useContext } from 'react';

/** Solo el canal enfocado; cambia al mover el foco en bouquets. */
export const HomeHeaderStateContext = createContext(null);

/** Acciones estables; no provoca re-render al usar solo el dispatch. */
export const HomeHeaderDispatchContext = createContext(null);

/** @deprecated Preferir useHomeHeaderState / useHomeHeaderDispatch según necesidad. */
export const HomeHeaderContext = HomeHeaderStateContext;

export function useHomeHeaderState() {
  const dispatch = useContext(HomeHeaderDispatchContext);
  const focusedChannel = useContext(HomeHeaderStateContext);
  if (!dispatch) {
    throw new Error('useHomeHeaderState debe usarse dentro de HomeHeaderProvider');
  }
  return focusedChannel;
}

export function useHomeHeaderDispatch() {
  const dispatch = useContext(HomeHeaderDispatchContext);
  if (!dispatch) {
    throw new Error('useHomeHeaderDispatch debe usarse dentro de HomeHeaderProvider');
  }
  return dispatch;
}

export function useHomeHeader() {
  const focusedChannel = useHomeHeaderState();
  const { setFocusedChannel, clearFocusedChannel } = useHomeHeaderDispatch();
  return { focusedChannel, setFocusedChannel, clearFocusedChannel };
}

export default HomeHeaderContext;
