import * as React from 'react';
import i18n from '@appvideo/core/locales/i18n';
import {useParentalGateStore} from '@appvideo/core/store/parentalGateStore';
import {PinModal} from './PinModal';
import {ConfirmModal} from '../components/ConfirmModal';

/**
 * Muestra el pedido de PIN cuando `parentalGateStore` lo abre
 * (requestPlayChannel / requestPlayMedia), en cualquier pantalla.
 * Montado una sola vez en App (como ParentalGateHost de la web).
 */
export function ParentalGateHost() {
  const gate = useParentalGateStore();
  if (!gate.open) return null;

  if (gate.gateKind === 'setupPin') {
    return (
      <ConfirmModal
        title={gate.title || i18n.t('parental.title')}
        message={gate.message || i18n.t('parental.setupPinMessage')}
        confirmLabel={i18n.t('common.close')}
        onConfirm={gate.closeGate}
        onCancel={gate.closeGate}
      />
    );
  }

  return (
    <PinModal
      title={gate.title || (gate.gateKind === 'channel' ? i18n.t('parental.channelBlockedTitle') : i18n.t('parental.restrictedTitle'))}
      message={gate.message || i18n.t('parental.restrictedMessage')}
      onSubmit={(pin) => gate.submitPin(pin)}
      onCancel={gate.closeGate}
    />
  );
}
