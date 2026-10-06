import { setParentalGateFocusAdapter } from '@appvideo/core/store/parentalGateStore';
import { rememberMainShellFocus } from './homeShellLastContentFocus';

/**
 * Foco del gate parental en la web: guarda el elemento activo (y, si está
 * dentro del contenido del home, lo recuerda para volver al cerrar).
 */
export function registerParentalGateWebFocus() {
  setParentalGateFocusAdapter({
    capture() {
      if (typeof document === 'undefined') return null;
      const active = document.activeElement;
      const main = document.querySelector('main.home-content[data-home-scope="content"]');
      if (active instanceof HTMLElement && main instanceof HTMLElement && main.contains(active)) {
        rememberMainShellFocus(active);
      }
      return active;
    },
  });
}
