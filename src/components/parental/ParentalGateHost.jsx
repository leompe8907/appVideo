import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParentalGate } from '../../hooks/useParentalGate';
import ParentalPinGate from './ParentalPinGate';

export function ParentalGateHost() {
  const { gate, closeGate, submitPin } = useParentalGate();
  const { t } = useTranslation();

  const title = useMemo(() => {
    if (gate?.title) return String(gate.title);
    const name = gate?.channel?.name ? String(gate.channel.name) : '';
    const base = t('parental.channelBlockedTitle', { defaultValue: 'Canal bloqueado' });
    return name ? `${base}: ${name}` : base;
  }, [gate?.title, gate?.channel?.name]);

  return (
    <ParentalPinGate
      open={!!gate?.open}
      title={title}
      message={gate?.message || t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para continuar' })}
      onCancel={closeGate}
      onSubmit={submitPin}
    />
  );
}

export default ParentalGateHost;

