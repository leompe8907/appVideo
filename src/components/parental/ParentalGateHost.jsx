import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useParentalGate } from '../../hooks/useParentalGate';
import { usePlayer } from '../../contexts/PlayerContext';
import ConfirmModal from '../ConfirmModal';
import ParentalPinGate from './ParentalPinGate';

export function ParentalGateHost() {
  const { gate, closeGate, submitPin } = useParentalGate();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { close } = usePlayer();

  const title = useMemo(() => {
    if (gate?.title) return String(gate.title);
    const name = gate?.channel?.name ? String(gate.channel.name) : '';
    const base = t('parental.channelBlockedTitle', { defaultValue: 'Canal bloqueado' });
    return name ? `${base}: ${name}` : base;
  }, [gate?.title, gate?.channel?.name, t]);

  const isSetupPin = gate?.gateKind === 'setupPin';

  return (
    <>
      <ConfirmModal
        open={!!gate?.open && isSetupPin}
        title={title || t('parental.title', { defaultValue: 'Control parental' })}
        message={
          gate?.message ||
          t('parental.setupPinMessage', { defaultValue: 'Para usar el control parental debes configurar un PIN.' })
        }
        confirmText={t('parental.goToSettings', { defaultValue: 'Configurar PIN' })}
        cancelText={t('common.close', { defaultValue: 'Cerrar' })}
        onConfirm={() => {
          closeGate();
          // Importante: cerrar el player para que se vea la UI de /home/control-parental
          // (HomePage oculta la UI cuando el player está activo).
          try {
            close?.();
          } catch {
            // noop
          }
          navigate('/home/control-parental');
        }}
        onCancel={closeGate}
      />

      <ParentalPinGate
        open={!!gate?.open && !isSetupPin}
        title={title}
        message={gate?.message || t('parental.restrictedMessage', { defaultValue: 'Ingresa el PIN para continuar' })}
        onCancel={closeGate}
        onSubmit={submitPin}
      />
    </>
  );
}

export default ParentalGateHost;

