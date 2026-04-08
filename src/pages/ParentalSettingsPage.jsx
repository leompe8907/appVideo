import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreload } from '../store/usePreload';
import { useParental } from '../store/useParental';
import { getChannelStableId } from '../utils/channelId';
import { useParentalGate } from '../hooks/useParentalGate';
import '../styles/pages/_parental.scss';

export function ParentalSettingsPage() {
  const { t } = useTranslation();
  const { epg } = usePreload();
  const parental = useParental();
  const { requestPlayChannel } = useParentalGate();
  const [pinDraft, setPinDraft] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const channels = useMemo(() => {
    const streams = epg?.streams || [];
    return [...streams].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0));
  }, [epg?.streams]);

  useEffect(() => {
    setPinMsg('');
  }, [parental.enabled]);

  const savePin = async () => {
    setPinMsg('');
    const value = String(pinDraft || '').replace(/\D/g, '').slice(0, 6);
    if (value.length < 4) {
      setPinMsg(t('parental.pinMin', { defaultValue: 'El PIN debe tener al menos 4 dígitos.' }));
      return;
    }
    try {
      await parental.setPin(value);
      setPinDraft('');
      setPinMsg(t('parental.pinSaved', { defaultValue: 'PIN guardado.' }));
    } catch {
      setPinMsg(t('parental.pinError', { defaultValue: 'No se pudo guardar el PIN.' }));
    }
  };

  const unlockActive =
    parental.enabled &&
    Number.isFinite(parental.unlockUntilMs) &&
    parental.unlockUntilMs != null &&
    Date.now() < parental.unlockUntilMs;

  return (
    <section className="parental-page" aria-label={t('parental.title', { defaultValue: 'Control parental' })}>
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
            <input
              className="parental-pin-input"
              value={pinDraft}
              placeholder="••••"
              inputMode="numeric"
              type="password"
              onChange={(e) => setPinDraft(String(e.target.value || '').replace(/\D/g, '').slice(0, 6))}
            />
            <button type="button" className="parental-btn" onClick={savePin}>
              {t('parental.savePin', { defaultValue: 'Guardar PIN' })}
            </button>
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
      </div>

      <div className="parental-card">
        <div className="parental-row__label">{t('parental.channels', { defaultValue: 'Canales' })}</div>
        {channels.length === 0 ? (
          <div className="parental-empty">
            {t('parental.noChannels', { defaultValue: 'No hay canales cargados. Asegúrate de haber hecho preload.' })}
          </div>
        ) : (
          <div className="parental-channel-list">
            {channels.map((ch) => {
              const id = getChannelStableId(ch);
              const blocked = parental.isChannelBlocked(id);
              const tempUnlocked = blocked && parental.isUnlockedFor(id);
              return (
                <button
                  key={id || ch.lcn || ch.name}
                  type="button"
                  className={[
                    'parental-channel',
                    blocked ? 'blocked' : '',
                    tempUnlocked ? 'temp-unlocked' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    // Reglas UX:
                    // - Para DESBLOQUEAR (cambiar de bloqueado -> permitido), pedir PIN si control parental está activo.
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
                >
                  <span className="parental-channel__lcn">{ch.lcn ?? ''}</span>
                  <span className="parental-channel__name">{ch.name ?? ''}</span>
                  <span className="parental-channel__state">
                    {blocked
                      ? (tempUnlocked
                        ? t('parental.tempUnlocked', { defaultValue: 'Bloqueado (desbloqueado temporal)' })
                        : t('parental.blocked', { defaultValue: 'Bloqueado' }))
                      : t('parental.allowed', { defaultValue: 'Permitido' })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default ParentalSettingsPage;

