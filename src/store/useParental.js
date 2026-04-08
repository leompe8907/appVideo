import { useParentalStore } from './parentalStore';

export function useParental() {
  const enabled = useParentalStore((s) => s.enabled);
  const blockedChannelIds = useParentalStore((s) => s.blockedChannelIds);
  const unlockUntilMs = useParentalStore((s) => s.unlockUntilMs);

  const setEnabled = useParentalStore((s) => s.setEnabled);
  const setPin = useParentalStore((s) => s.setPin);
  const verifyPin = useParentalStore((s) => s.verifyPin);
  const hasPinConfigured = useParentalStore((s) => s.hasPinConfigured);
  const toggleBlock = useParentalStore((s) => s.toggleBlock);
  const isChannelBlocked = useParentalStore((s) => s.isChannelBlocked);
  const isUnlockedFor = useParentalStore((s) => s.isUnlockedFor);
  const unlockWithPin = useParentalStore((s) => s.unlockWithPin);
  const lockNow = useParentalStore((s) => s.lockNow);

  return {
    enabled,
    blockedChannelIds,
    unlockUntilMs,
    setEnabled,
    setPin,
    verifyPin,
    hasPinConfigured,
    toggleBlock,
    isChannelBlocked,
    isUnlockedFor,
    unlockWithPin,
    lockNow,
  };
}

export default useParental;

