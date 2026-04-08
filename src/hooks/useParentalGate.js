import { useParentalGateStore } from '../store/parentalGateStore';

/**
 * Hook thin-wrapper sobre un store global.
 * Importante: el gate debe ser único en toda la app, para que el Host (HomePage)
 * vea el mismo estado que los entrypoints (Bouquet/EPG/Search).
 */
export function useParentalGate() {
  const open = useParentalGateStore((s) => s.open);
  const channel = useParentalGateStore((s) => s.channel);
  const title = useParentalGateStore((s) => s.title);
  const message = useParentalGateStore((s) => s.message);
  const requestPlayChannel = useParentalGateStore((s) => s.requestPlayChannel);
  const closeGate = useParentalGateStore((s) => s.closeGate);
  const submitPin = useParentalGateStore((s) => s.submitPin);

  return {
    gate: { open, channel, title, message },
    requestPlayChannel,
    closeGate,
    submitPin,
  };
}

export default useParentalGate;

