/**
 * Overlays del shell Home montados vía portal o en raíz.
 * Usados por HomeInputDispatcher para prioridad de BACK sin acoplar a React state ajeno.
 */

export const HOME_SHELL_OVERLAY_SELECTORS = Object.freeze({
  confirmModal: '.confirm-modal-overlay',
  parentalPin: '.parental-pin-overlay[role="dialog"]',
  /** Recordatorio EPG y modal de detalle comparten clase raíz */
  epgEventModal: '.epg-event-modal-overlay[role="dialog"]',
  inactivity: '.inactivity-overlay[role="dialog"]',
  screensaver: '.screensaver[role="dialog"]',
  playerChannelSidebar: '.player-channel-sidebar-overlay[role="dialog"]',
  vodDetail: '.vod-detail-overlay[role="dialog"]',
  vodCategory: '.vod-category-overlay[role="dialog"]',
  profileModals: '.create-profile-overlay[role="dialog"]',
  messageModal: '.message-modal-overlay[role="dialog"]',
  osmsNotification: '.osms-notification-overlay[role="dialog"]',
  osmsMessageModal: '.osms-modal-overlay[role="dialog"]',
  osdKeyboard: '.osd-keyboard-container',
});

/** @deprecated usar isEpgEventModalOverlayInDom */
export function isEpgReminderOverlayInDom() {
  return isEpgEventModalOverlayInDom();
}

/**
 * @returns {boolean}
 */
export function isEpgEventModalOverlayInDom() {
  try {
    return Boolean(document.querySelector(HOME_SHELL_OVERLAY_SELECTORS.epgEventModal));
  } catch {
    return false;
  }
}

/**
 * Cierra el recordatorio EPG (mismos ids que EpgReminderHost).
 * @returns {boolean} true si se disparó cierre
 */
export function dismissEpgReminderOverlayFromDom() {
  try {
    const root = document.querySelector(HOME_SHELL_OVERLAY_SELECTORS.epgEventModal);
    if (!root) return false;
    const btn =
      document.getElementById('epg-reminder-close') ||
      document.getElementById('epg-reminder-close-x');
    if (btn && typeof btn.click === 'function') {
      btn.click();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * @returns {boolean}
 */
export function isOsdKeyboardOverlayInDom() {
  try {
    return Boolean(document.querySelector(HOME_SHELL_OVERLAY_SELECTORS.osdKeyboard));
  } catch {
    return false;
  }
}

/**
 * Cierra el teclado virtual OSD (mismos ids que VirtualKeyboard).
 * @returns {boolean} true si se disparó cierre
 */
export function dismissOsdKeyboardOverlayFromDom() {
  try {
    const root = document.querySelector(HOME_SHELL_OVERLAY_SELECTORS.osdKeyboard);
    if (!root) return false;
    const cancelBtn =
      document.getElementById('key-action-cancel') ||
      root.querySelector('.osd-keyboard-key--cancel');
    if (cancelBtn && typeof cancelBtn.click === 'function') {
      cancelBtn.click();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Overlays/portales que deben recibir input antes que el shell (BACK, LRUD sidebar↔main).
 * @returns {boolean}
 */
export function shouldDeferHomeShellNavigation() {
  try {
    const s = HOME_SHELL_OVERLAY_SELECTORS;
    const checks = [
      s.confirmModal,
      s.parentalPin,
      s.epgEventModal,
      s.inactivity,
      s.screensaver,
      s.playerChannelSidebar,
      s.vodDetail,
      s.vodCategory,
      s.profileModals,
      s.messageModal,
      s.osmsNotification,
      s.osmsMessageModal,
      s.osdKeyboard,
    ];
    for (const sel of checks) {
      if (document.querySelector(sel)) return true;
    }
    return false;
  } catch {
    return true;
  }
}
