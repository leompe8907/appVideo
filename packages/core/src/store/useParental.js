import { useParentalStore } from './parentalStore';

export function useParental() {
  const enabled = useParentalStore((s) => s.enabled);
  const blockedChannelIds = useParentalStore((s) => s.blockedChannelIds);
  const unlockUntilMs = useParentalStore((s) => s.unlockUntilMs);
  const ratingEnabled = useParentalStore((s) => s.ratingEnabled);
  const ratingAllowedMax = useParentalStore((s) => s.ratingAllowedMax);
  const ratingApplyToLive = useParentalStore((s) => s.ratingApplyToLive);
  const ratingUnlockUntilMs = useParentalStore((s) => s.ratingUnlockUntilMs);

  const setEnabled = useParentalStore((s) => s.setEnabled);
  const setRatingEnabled = useParentalStore((s) => s.setRatingEnabled);
  const setRatingAllowedMax = useParentalStore((s) => s.setRatingAllowedMax);
  const setRatingApplyToLive = useParentalStore((s) => s.setRatingApplyToLive);
  const setPin = useParentalStore((s) => s.setPin);
  const verifyPin = useParentalStore((s) => s.verifyPin);
  const hasPinConfigured = useParentalStore((s) => s.hasPinConfigured);
  const toggleBlock = useParentalStore((s) => s.toggleBlock);
  const isChannelBlocked = useParentalStore((s) => s.isChannelBlocked);
  const isUnlockedFor = useParentalStore((s) => s.isUnlockedFor);
  const unlockWithPin = useParentalStore((s) => s.unlockWithPin);
  const isRatingUnlocked = useParentalStore((s) => s.isRatingUnlocked);
  const unlockRatingWithPin = useParentalStore((s) => s.unlockRatingWithPin);
  const isParentalControlUnlocked = useParentalStore((s) => s.isParentalControlUnlocked);
  const unlockParentalControlWithPin = useParentalStore((s) => s.unlockParentalControlWithPin);
  const invalidateParentalControlUnlock = useParentalStore((s) => s.invalidateParentalControlUnlock);
  const lockNow = useParentalStore((s) => s.lockNow);

  return {
    enabled,
    blockedChannelIds,
    unlockUntilMs,
    ratingEnabled,
    ratingAllowedMax,
    ratingApplyToLive,
    ratingUnlockUntilMs,
    setEnabled,
    setRatingEnabled,
    setRatingAllowedMax,
    setRatingApplyToLive,
    setPin,
    verifyPin,
    hasPinConfigured,
    toggleBlock,
    isChannelBlocked,
    isUnlockedFor,
    unlockWithPin,
    isRatingUnlocked,
    unlockRatingWithPin,
    isParentalControlUnlocked,
    unlockParentalControlWithPin,
    invalidateParentalControlUnlock,
    lockNow,
  };
}

export default useParental;

