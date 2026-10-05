import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { focusManager, createZoneId } from '../../navigation/FocusManager';
import { focusElementSafe } from '../../navigation/spatialNavigation';
import {
  getControllerSession,
  listDevices,
  sendCommand,
  sendContent,
  setControllerSession,
  subscribeCast,
} from '../../services/castService';
import { castErrorKey, pickSendTargets } from './castModalLogic';

const INITIAL_FOCUS_DELAY_MS = 50;

function formatClock(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * Selector de dispositivo + control remoto de una transmisión.
 *
 * Vista "devices": lista los dispositivos de la cuenta que pueden recibir y
 * envía el contenido actual (solo `kind` + `id`, ver castService).
 * Vista "remote": tras enviar, muestra el estado que reporta el receptor y
 * permite pausar/reanudar, saltar, detener y cambiar audio/subtítulos.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{kind: string, id: number, title?: string, startPositionSeconds?: number}|null} props.content
 * @param {() => void} [props.onSent] se llama cuando el receptor aceptó el envío
 * @param {boolean} [props.startInRemote] abre directo el control remoto de la transmisión en curso
 */
export function CastModal({ open, onClose, content, onSent, startInRemote = false }) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const zoneIdRef = useRef(null);
  if (!zoneIdRef.current) zoneIdRef.current = createZoneId('cast-modal');

  const [view, setView] = useState('devices'); // 'devices' | 'remote'
  const [devices, setDevices] = useState(null); // null = cargando
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [session, setSession] = useState(null); // { id, deviceName }
  const [remote, setRemote] = useState(null); // último cast.state
  const [displaced, setDisplaced] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    setDevices(null);
    try {
      setDevices(await listDevices());
    } catch (e) {
      setDevices([]);
      setError(castErrorKey(e && e.code));
    }
  }, []);

  // Al abrir: vista de dispositivos y lista fresca.
  useEffect(() => {
    if (!open) return;
    setRemote(null);
    setDisplaced(false);
    setBusyId(null);
    setError('');
    const current = startInRemote ? getControllerSession() : null;
    if (current) {
      setSession(current);
      setView('remote');
      return;
    }
    setView('devices');
    setSession(null);
    refresh();
  }, [open, refresh, startInRemote]);

  // Foco / BACK como cualquier otro modal de la app.
  useEffect(() => {
    if (!open) return undefined;
    const zoneId = zoneIdRef.current;
    focusManager.push(zoneId, { containerEl: rootRef.current, onBack: onClose });
    const timer = setTimeout(() => {
      focusElementSafe(rootRef.current?.querySelector('button'));
    }, INITIAL_FOCUS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      focusManager.pop(zoneId);
    };
  }, [open, onClose]);

  // Estado de la transmisión enviada.
  const sessionId = session?.id;
  useEffect(() => {
    if (!open || !sessionId) return undefined;
    return subscribeCast((message) => {
      if (message.session_id !== sessionId) return;
      if (message.type === 'cast.state') setRemote(message);
      if (message.type === 'cast.displaced') {
        setDisplaced(true);
        setControllerSession(null);
      }
    });
  }, [open, sessionId]);

  const handleSend = async (device) => {
    if (busyId != null || !content) return;
    setBusyId(device.id);
    setError('');
    try {
      const res = await sendContent({ targetDeviceId: device.id, content });
      const next = { id: res.session_id, deviceName: device.name, content };
      setControllerSession(next);
      setSession(next);
      setView('remote');
      if (onSent) onSent();
    } catch (e) {
      setError(castErrorKey(e && e.code));
    } finally {
      setBusyId(null);
    }
  };

  const run = async (command, args) => {
    if (!sessionId) return;
    try {
      await sendCommand({ sessionId, command, args });
    } catch (e) {
      setError(castErrorKey(e && e.code));
    }
  };

  if (!open) return null;

  const targets = pickSendTargets(devices);
  const isPlaying = remote?.state === 'playing';
  const isLive = content?.kind === 'service';
  const tracks = remote?.tracks;

  return createPortal(
    <div ref={rootRef} className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal cast-modal">
        {view === 'devices' ? (
          <>
            <h4 className="confirm-modal__title">{t('cast.title', { defaultValue: 'Transmitir a' })}</h4>
            {devices === null ? (
              <p className="confirm-modal__message">{t('common.loading', { defaultValue: 'Cargando...' })}</p>
            ) : targets.length === 0 ? (
              <p className="confirm-modal__message">
                {t('cast.noDevices', {
                  defaultValue: 'No hay dispositivos disponibles. Abrí la app en otro dispositivo con tu cuenta.',
                })}
              </p>
            ) : (
              <div className="cast-modal__list" role="list">
                {targets.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    role="listitem"
                    className="confirm-modal__btn cast-modal__device"
                    disabled={busyId != null}
                    onClick={() => handleSend(d)}
                  >
                    <span>{d.name}</span>
                    {d.playing ? (
                      <span className="cast-modal__meta">{t('cast.playingNow', { defaultValue: 'reproduciendo' })}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h4 className="confirm-modal__title">
              {t('cast.remoteTitle', { defaultValue: 'Transmitiendo a {{name}}', name: session?.deviceName })}
            </h4>
            {displaced ? (
              <p className="confirm-modal__message">
                {t('cast.displaced', { defaultValue: 'Otro dispositivo tomó la transmisión.' })}
              </p>
            ) : (
              <>
                <p className="confirm-modal__message">
                  {remote
                    ? `${t(`cast.state.${remote.state}`, { defaultValue: remote.state })}${
                        isLive ? '' : ` · ${formatClock(remote.position_ms)} / ${formatClock(remote.duration_ms)}`
                      }`
                    : t('cast.waiting', { defaultValue: 'Esperando al dispositivo...' })}
                </p>
                <div className="cast-modal__controls">
                  {!isLive ? (
                    <button type="button" className="confirm-modal__btn" onClick={() => run('seek', { position_ms: Math.max(0, (remote?.position_ms || 0) - 10000) })}>
                      -10s
                    </button>
                  ) : null}
                  <button type="button" className="confirm-modal__btn confirm-modal__btn--primary" onClick={() => run(isPlaying ? 'pause' : 'play')}>
                    {isPlaying ? t('player.pause', { defaultValue: 'Pausar' }) : t('player.play', { defaultValue: 'Reproducir' })}
                  </button>
                  {!isLive ? (
                    <button type="button" className="confirm-modal__btn" onClick={() => run('seek', { position_ms: (remote?.position_ms || 0) + 10000 })}>
                      +10s
                    </button>
                  ) : null}
                  <button type="button" className="confirm-modal__btn" onClick={() => { run('stop'); setControllerSession(null); onClose(); }}>
                    {t('cast.stop', { defaultValue: 'Detener' })}
                  </button>
                </div>
                {tracks && tracks.audio && tracks.audio.length > 1 ? (
                  <div className="cast-modal__list" role="list" aria-label={t('player.audio', { defaultValue: 'Audio' })}>
                    {tracks.audio.map((trk) => (
                      <button
                        key={`a-${trk.id}`}
                        type="button"
                        role="listitem"
                        className={`confirm-modal__btn${tracks.selected_audio === trk.id ? ' confirm-modal__btn--primary' : ''}`}
                        onClick={() => run('select_audio', { track_id: trk.id })}
                      >
                        {trk.label || trk.lang || 'Audio'}
                      </button>
                    ))}
                  </div>
                ) : null}
                {tracks && tracks.text && tracks.text.length > 0 ? (
                  <div className="cast-modal__list" role="list" aria-label={t('player.subtitles', { defaultValue: 'Subtítulos' })}>
                    <button
                      type="button"
                      role="listitem"
                      className={`confirm-modal__btn${tracks.selected_text == null ? ' confirm-modal__btn--primary' : ''}`}
                      onClick={() => run('select_text', { track_id: null })}
                    >
                      {t('player.subtitlesOff', { defaultValue: 'Desactivados' })}
                    </button>
                    {tracks.text.map((trk) => (
                      <button
                        key={`s-${trk.id}`}
                        type="button"
                        role="listitem"
                        className={`confirm-modal__btn${tracks.selected_text === trk.id ? ' confirm-modal__btn--primary' : ''}`}
                        onClick={() => run('select_text', { track_id: trk.id })}
                      >
                        {trk.label || trk.lang || 'Sub'}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
        {error ? <p className="confirm-modal__message cast-modal__error">{t(error.key, { defaultValue: error.fallback })}</p> : null}
        <div className="confirm-modal__actions">
          {view === 'devices' ? (
            <button type="button" className="confirm-modal__btn" onClick={refresh}>
              {t('cast.refresh', { defaultValue: 'Actualizar' })}
            </button>
          ) : null}
          <button type="button" className="confirm-modal__btn" onClick={onClose}>
            {t('common.close', { defaultValue: 'Cerrar' })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CastModal;
