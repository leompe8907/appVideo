import { useCallback, useMemo, useState } from 'react';
import { HomeHeaderDispatchContext, HomeHeaderStateContext } from './homeHeaderContext';
import { getChannelStableId } from '../utils/channelId';

export function HomeHeaderProvider({ children }) {
  const [focusedChannel, setFocusedChannelState] = useState(null);

  const setFocusedChannel = useCallback((channel) => {
    setFocusedChannelState((prev) => {
      const prevId = prev ? getChannelStableId(prev) : '';
      const nextId = channel ? getChannelStableId(channel) : '';
      if (prevId && nextId && prevId === nextId) return prev;
      return channel ?? null;
    });
  }, []);

  const clearFocusedChannel = useCallback(() => {
    setFocusedChannelState(null);
  }, []);

  const dispatch = useMemo(
    () => ({
      setFocusedChannel,
      clearFocusedChannel,
    }),
    [setFocusedChannel, clearFocusedChannel]
  );

  return (
    <HomeHeaderDispatchContext.Provider value={dispatch}>
      <HomeHeaderStateContext.Provider value={focusedChannel}>
        {children}
      </HomeHeaderStateContext.Provider>
    </HomeHeaderDispatchContext.Provider>
  );
}

export default HomeHeaderProvider;
