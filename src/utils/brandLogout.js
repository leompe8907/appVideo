/**
 * Reinicia estado en memoria de stores por marca tras cerrar sesión.
 */

import { useParentalStore } from '../store/parentalStore';
import { useEpgReminderStore } from '../store/epgReminderStore';
import { useOsmsStore } from '../store/osmsStore';

export function resetBrandStoresOnLogout() {
  try {
    useParentalStore.getState().resetOnLogout?.();
  } catch {
    // noop
  }
  try {
    useEpgReminderStore.getState().resetOnLogout?.();
  } catch {
    // noop
  }
  try {
    useOsmsStore.getState().resetOsms?.();
  } catch {
    // noop
  }
}
