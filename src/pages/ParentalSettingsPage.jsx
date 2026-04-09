import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreload } from '../store/usePreload';
import { useParental } from '../store/useParental';
import { getChannelStableId } from '../utils/channelId';
import { useParentalGate } from '../hooks/useParentalGate';
import ParentalChannelCard from '../components/parental/ParentalChannelCard';
import ParentalPinGate from '../components/parental/ParentalPinGate';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/pages/_parental.scss';

export function ParentalSettingsPage() {
  const { t } = useTranslation();
  const { epg } = usePreload();
  const parental = useParental();
  const { requestPlayChannel } = useParentalGate();
  const [pinMsg, setPinMsg] = useState('');
  const [pinStep, setPinStep] = useState(''); // '' | 'verify-old' | 'set-new'
  const [pendingOldPin, setPendingOldPin] = useState('');
  const [showForgotPin, setShowForgotPin] = useState(false);

  const channels = useMemo(() => {
    const streams = epg?.streams || [];
    return [...streams].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  }, [epg?.streams]);

  useEffect(() => {
    setPinMsg('');
  }, [parental.enabled]);

  const openChangePinFlow = () => {
    setPinMsg('');
    setPendingOldPin('');
    if (parental.hasPinConfigured()) {
      setPinStep('verify-old');
      return;
    }
    // Si no hay PIN aún, crear uno directamente.
    setPinStep('set-new');
  };

  const unlockActive =
    parental.enabled &&
    Number.isFinite(parental.unlockUntilMs) &&
    parental.unlockUntilMs != null &&
    Date.now() < parental.unlockUntilMs;

  return (
    <section className="parental-page" aria-label={t('parental.title', { defaultValue: 'Control parental' })}>
      <ConfirmModal
        open={showForgotPin}
        title={t('parental.forgotPinTitle', { defaultValue: 'Olvidé mi PIN' })}
        message={t('parental.forgotPinMessage', {
          defaultValue:
            'Por seguridad, el PIN no se puede restablecer desde aquí sin verificación. Debes iniciar sesión nuevamente o contactar soporte según la política de tu servicio.',
        })}
        confirmText={t('common.close', { defaultValue: 'Cerrar' })}
        onConfirm={() => setShowForgotPin(false)}
      />

      <ParentalPinGate
        open={pinStep === 'verify-old'}
        title={t('parental.changePin', { defaultValue: 'Cambiar PIN' })}
        message={t('parental.enterCurrentPin', { defaultValue: 'Ingresa el PIN actual para continuar.' })}
        onCancel={() => {
          setPinStep('');
          setPendingOldPin('');
        }}
        onSubmit={async (pin) => {
          try {
            const ok = await parental.verifyPin(pin);
            if (!ok) return false;
            setPendingOldPin(pin);
            setPinStep('set-new');
            return true;
          } catch {
            return false;
          }
        }}
      />

      <ParentalPinGate
        open={pinStep === 'set-new'}
        title={t('parental.setPinTitle', { defaultValue: 'Configurar PIN' })}
        message={t('parental.enterNewPin', { defaultValue: 'Ingresa el nuevo PIN (4 a 6 dígitos).' })}
        onCancel={() => {
          setPinStep('');
          setPendingOldPin('');
        }}
        onSubmit={async (pin) => {
          const digits = String(pin || '').replace(/\D/g, '').slice(0, 6);
          if (digits.length < 4) {
            setPinMsg(t('parental.pinMin', { defaultValue: 'El PIN debe tener al menos 4 dígitos.' }));
            return false;
          }
          try {
            // Si había PIN anterior, ya fue verificado en el paso previo.
            void pendingOldPin;
            await parental.setPin(digits);
            setPinMsg(t('parental.pinSaved', { defaultValue: 'PIN guardado.' }));
            setPendingOldPin('');
            setPinStep('');
            return true;
          } catch {
            setPinMsg(t('parental.pinError', { defaultValue: 'No se pudo guardar el PIN.' }));
            return false;
          }
        }}
      />

      <div className="parental-header">
        <h2 className="parental-title">{t('parental.title', { defaultValue: 'Control parental' })}</h2>
        <div className="parental-subtitle">
          {t('parental.subtitle', { defaultValue: 'Bloquea el acceso a canales con PIN (sin ocultarlos).' })}
        </div>
      </div>

      <div className="parental-card">
        <div className="parental-row">
          <div className="parental-row__label">{t('parental.enabled', { defaultValue: 'Activar control parental' })}</div>
          <button
            type="button"
            className={`parental-toggle${parental.enabled ? ' active' : ''}`}
            onClick={() => parental.setEnabled(!parental.enabled)}
          >
            {parental.enabled ? t('common.on', { defaultValue: 'ON' }) : t('common.off', { defaultValue: 'OFF' })}
          </button>
        </div>

        <div className="parental-divider" />

        <div className="parental-row">
          <div className="parental-row__label">{t('parental.pin', { defaultValue: 'PIN' })}</div>
          <div className="parental-pin-controls">
            <button type="button" className="parental-btn" onClick={openChangePinFlow}>
              {parental.hasPinConfigured()
                ? t('parental.changePin', { defaultValue: 'Cambiar PIN' })
                : t('parental.setPin', { defaultValue: 'Configurar PIN' })}
            </button>
            {parental.hasPinConfigured() ? (
              <button
                type="button"
                className="parental-btn parental-btn--secondary"
                onClick={() => setShowForgotPin(true)}
              >
                {t('parental.forgotPin', { defaultValue: 'Olvidé mi PIN' })}
              </button>
            ) : null}
            <button type="button" className="parental-btn parental-btn--secondary" onClick={() => parental.lockNow()}>
              {t('parental.lockNow', { defaultValue: 'Bloquear ahora' })}
            </button>
          </div>
        </div>
        {pinMsg ? <div className="parental-msg">{pinMsg}</div> : null}
        {unlockActive ? (
          <div className="parental-msg">
            {t('parental.unlockActive', {
              defaultValue: 'Desbloqueo temporal activo. Los canales bloqueados permitirán reproducir hasta que presiones “Bloquear ahora” o expire el tiempo.',
            })}
          </div>
        ) : null}

        <div className="parental-divider" />

        <div className="parental-row">
          <div className="parental-row__label">
            {t('parental.ratingTitle', { defaultValue: 'Clasificación (BR)' })}
          </div>
          <div className="parental-rating-hint">
            {t('parental.ratingHint', { defaultValue: 'Configura el límite de edad para pedir PIN al reproducir.' })}
          </div>
        </div>

        <div className="parental-rating-controls">
          <div className="parental-rating-label">
            {t('parental.ratingAllowUpTo', { defaultValue: 'Permitir hasta' })}
          </div>
          <div className="parental-rating-segment" role="group" aria-label={t('parental.ratingAllowUpTo', { defaultValue: 'Permitir hasta' })}>
            {[
              { key: 'none', label: t('parental.ratingNoRestrictions', { defaultValue: 'Sin restricciones' }) },
              { key: 'L', label: t('parental.ratingLivreShort', { defaultValue: 'L' }), value: 0 },
              { key: '10', label: '10', value: 10 },
              { key: '12', label: '12', value: 12 },
              { key: '14', label: '14', value: 14 },
              { key: '16', label: '16', value: 16 },
              { key: '18', label: '18', value: 18 },
            ].map((opt) => {
              const isActive =
                opt.key === 'none'
                  ? parental.ratingEnabled !== true
                  : parental.ratingEnabled === true && Number(parental.ratingAllowedMax ?? 18) === Number(opt.value);

              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`parental-rating-segbtn${isActive ? ' active' : ''}`}
                  onClick={() => {
                    if (opt.key === 'none') {
                      parental.setRatingEnabled(false);
                      return;
                    }
                    parental.setRatingEnabled(true);
                    parental.setRatingAllowedMax(opt.value);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {parental.ratingEnabled ? (
            <label className="parental-rating-checkbox">
              <input
                type="checkbox"
                checked={parental.ratingApplyToLive !== false}
                onChange={(e) => parental.setRatingApplyToLive(e.target.checked)}
              />
              {t('parental.ratingApplyToLive', { defaultValue: 'Aplicar a TV en vivo (EPG)' })}
            </label>
          ) : null}
        </div>
      </div>

      <div className="parental-card">
        <div className="parental-row__label">{t('parental.channels', { defaultValue: 'Canales' })}</div>
        {channels.length === 0 ? (
          <div className="parental-empty">
            {t('parental.noChannels', { defaultValue: 'No hay canales cargados. Asegúrate de haber hecho preload.' })}
          </div>
        ) : (
          <div className="parental-channel-grid">
            {channels.map((ch) => {
              const id = getChannelStableId(ch);
              const blocked = parental.isChannelBlocked(id);
              return (
                <ParentalChannelCard
                  key={id || ch.lcn || ch.name}
                  channel={ch}
                  blocked={blocked}
                  onSelect={() => {
                    // Reglas UX:
                    // - Para DESBLOQUEAR (bloqueado -> permitido), pedir PIN si control parental está activo.
                    // - Para BLOQUEAR, no pedir PIN (acción del adulto) pero sí invalidar unlock global (lo hace el store).
                    if (parental.enabled && parental.hasPinConfigured() && blocked) {
                      requestPlayChannel({
                        channel: ch,
                        title: t('parental.confirmChangeTitle', { defaultValue: 'Control parental' }),
                        message: t('parental.confirmChangeMessage', { defaultValue: 'Ingresa el PIN para cambiar el bloqueo del canal.' }),
                        purpose: 'action',
                        playFn: () => parental.toggleBlock(id),
                      });
                      return;
                    }
                    parental.toggleBlock(id);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default ParentalSettingsPage;

