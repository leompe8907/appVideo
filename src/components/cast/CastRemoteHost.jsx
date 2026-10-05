import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CastModal from './CastModal';
import {
  getControllerSession,
  sendCommand,
  setControllerSession,
  subscribeCast,
  subscribeController,
} from '../../services/castService';

const TERMINAL = new Set(['idle', 'ended', 'error']);

/**
 * Mini-control flotante de la transmisión que ESTE dispositivo envió. Sigue
 * visible aunque se cierre el reproductor y permite pausar/reanudar, detener
 * o abrir el control completo (saltos, audio y subtítulos).
 * No muestra nada si no hay una transmisión en curso.
 */
export function CastRemoteHost() {
  const { t } = useTranslation();
  const [session, setSession] = useState(getControllerSession());
  const [remote, setRemote] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => subscribeController((s) => {
    setSession(s);
    if (!s) {
      setRemote(null);
      setPanelOpen(false);
    }
  }), []);

  const sessionId = session?.id;
  useEffect(() => {
    if (!sessionId) return undefined;
    return subscribeCast((message) => {
      if (message.session_id !== sessionId) return;
      if (message.type === 'cast.displaced') {
        setControllerSession(null);
      } else if (message.type === 'cast.state') {
        // El receptor terminó o se cortó: la transmisión ya no existe.
        if (TERMINAL.has(message.state)) setControllerSession(null);
        else setRemote(message);
      }
    });
  }, [sessionId]);

  if (!session) return null;

  const isPlaying = remote?.state === 'playing';
  const run = (command) => sendCommand({ sessionId, command }).catch(() => {});

  return (
    <>
      <div className="cast-remote" role="region" aria-label={t('cast.remoteTitle', { defaultValue: 'Transmitiendo a {{name}}', name: session.deviceName })}>
        <span className="cast-remote__label">
          {t('cast.remoteTitle', { defaultValue: 'Transmitiendo a {{name}}', name: session.deviceName })}
        </span>
        <button type="button" className="cast-remote__btn" onClick={() => run(isPlaying ? 'pause' : 'play')}>
          {isPlaying ? t('player.pause', { defaultValue: 'Pausar' }) : t('player.play', { defaultValue: 'Reproducir' })}
        </button>
        <button type="button" className="cast-remote__btn" onClick={() => setPanelOpen(true)}>
          {t('cast.options', { defaultValue: 'Opciones' })}
        </button>
        <button
          type="button"
          className="cast-remote__btn"
          onClick={() => {
            run('stop');
            setControllerSession(null);
          }}
        >
          {t('cast.stop', { defaultValue: 'Detener' })}
        </button>
      </div>
      <CastModal open={panelOpen} startInRemote content={session.content} onClose={() => setPanelOpen(false)} />
    </>
  );
}

export default CastRemoteHost;
