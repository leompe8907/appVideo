/**
 * Reinicia estado en memoria de stores por marca tras cerrar sesión.
 */

import { useParentalStore } from '../store/parentalStore';
import { useEpgReminderStore } from '../store/epgReminderStore';
import { useOsmsStore } from '../store/osmsStore';
import { usePreloadStore } from '../store/preloadStore';
import { useSearchSessionStore } from '../store/searchSessionStore';
import { useActiveProfileStore } from '../store/activeProfileStore';

export function resetBrandStoresOnLogout() {
  try {
    useParentalStore.getState().resetOnLogout?.();
  } catch {
    // noop
  }
  try {
    useActiveProfileStore.getState().resetOnLogout?.();
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
  try {
    usePreloadStore.getState().resetPreload?.();
  } catch {
    // noop
  }
  try {
    useSearchSessionStore.getState().resetOnLogout?.();
  } catch {
    // noop
  }
}
