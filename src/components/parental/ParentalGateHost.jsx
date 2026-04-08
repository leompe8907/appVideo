import { useMemo } from 'react';
import { useParentalGate } from '../../hooks/useParentalGate';
import ParentalPinGate from './ParentalPinGate';

export function ParentalGateHost() {
  const { gate, closeGate, submitPin } = useParentalGate();

  const title = useMemo(() => {
    if (gate?.title) return String(gate.title);
    const name = gate?.channel?.name ? String(gate.channel.name) : '';
    return name ? `Canal bloqueado: ${name}` : 'Canal bloqueado';
  }, [gate?.title, gate?.channel?.name]);

  return (
    <ParentalPinGate
      open={!!gate?.open}
      title={title}
      message={gate?.message || 'Ingresa el PIN para continuar'}
      onCancel={closeGate}
      onSubmit={submitPin}
    />
  );
}

export default ParentalGateHost;

