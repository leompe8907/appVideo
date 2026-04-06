import { useMemo, useState } from 'react';
import { HomeHeaderContext } from './homeHeaderContext';

export function HomeHeaderProvider({ children }) {
  const [focusedChannel, setFocusedChannel] = useState(null);

  const value = useMemo(
    () => ({
      focusedChannel,
      setFocusedChannel,
      clearFocusedChannel: () => setFocusedChannel(null),
    }),
    [focusedChannel]
  );

  return (
    <HomeHeaderContext.Provider value={value}>
      {children}
    </HomeHeaderContext.Provider>
  );
}

export default HomeHeaderProvider;

