import { useRef } from 'react';
import { useDevice } from '../../contexts/DeviceContext';

export function useSpatialNavigation(config = {}) {
  const { isTV } = useDevice();
  const pcRef = useRef(null);

  const mergedRef = (node) => {
    pcRef.current = node;
  };

  return {
    ref: mergedRef,
    focused: false,
    focusSelf: () => {
      if (pcRef.current) pcRef.current.focus();
    },
    hasFocusedChild: false,
    isTV,
  };
}

export default useSpatialNavigation;
