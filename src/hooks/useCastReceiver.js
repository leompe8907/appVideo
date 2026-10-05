import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useParentalGate } from './useParentalGate';
import { usePreload } from '../store/usePreload';
import panaccessService from '../services/panaccessService';
import { initCast, isCastEnabled, reportState, subscribeCast, msToSeconds } from '../services/castService';
import { applyCastCommand, buildCastState, resolvePlayRequest } from '../services/castReceiver';

const STATE_REPORT_INTERVAL_MS = 5000;

/**
 * Receptor de transmisiones entre dispositivos ("cast"): cuando otro
 * dispositivo de la cuenta le envía un contenido a este, lo reproduce, ejecuta
 * los comandos remotos (pausa, seek, audio/subtítulos...) y reporta su
 * estado para que el controlador lo vea en tiempo real.
 *
 * Apagado por defecto: no hace nada si la marca no tiene
 * `features.castEnabled` (ver `services/castService.js`).
 *
 * Control parental: la reproducción recibida pasa por el MISMO gate que
 * cualquier otro punto de entrada (`requestPlayChannel` / `requestPlayMedia`),
 * así que transmitir no sirve para saltarse el PIN. Limitación conocida:
 * para VOD no se evalúa la clasificación por edad (el mensaje trae solo el
 * id y esta app no tiene el catálogo VOD precargado para buscarlo), por lo
 * que solo aplican los bloqueos por PIN generales.
 */
export function useCastReceiver() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const enabled = isCastEnabled(currentBrand);
  const player = usePlayer();
  const { epg } = usePreload();
  const { requestPlayChannel, requestPlayMedia } = useParentalGate();

  // El valor de contexto del player se recrea en cada render y sus funciones
  // cierran sobre el estado de ESE render: se guarda siempre el último.
  const playerRef = useRef(player);
  playerRef.current = player;
  const depsRef = useRef({});
  depsRef.current = { streams: epg?.streams, requestPlayChannel, requestPlayMedia, t };

  // Sesión de transmisión que este dispositivo está recibiendo.
  // { id, content, url, started, pendingSeekSeconds }
  const sessionRef = useRef(null);

  const reportNow = () => {
    const session = sessionRef.current;
    if (!session) return;
    const p = playerRef.current;
    const body = buildCastState(p.state, p.tracks, session.content);

    // Playback todavía no arrancó (esperando PIN o cargando): no confundirlo
    // con "terminó".
    if (!session.started) {
      if (p.state?.url && p.state.url === session.url) session.started = true;
      else {
        reportState(session.id, { ...body, state: 'loading' });
        return;
      }
    }

    // Después de arrancar, que no haya url significa que se cortó acá mismo
    // (el usuario paró desde la TV): se informa y se cierra la sesión.
    reportState(session.id, body);
    if (body.state === 'idle' || body.state === 'ended' || body.state === 'error') {
      sessionRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;
    const stopInit = initCast(currentBrand);

    const unsubscribe = subscribeCast((message) => {
      const d = depsRef.current;
      const p = playerRef.current;

      if (message.type === 'cast.incoming') {
        const resolved = resolvePlayRequest(message.content, {
          streams: d.streams,
          panaccess: panaccessService,
        });
        if (resolved.error) {
          reportState(message.session_id, { state: 'error', position_ms: 0, duration_ms: 0 });
          return;
        }

        const startSeconds = msToSeconds(message.content?.start_position_ms);
        sessionRef.current = {
          id: message.session_id,
          content: { kind: message.content.kind, id: message.content.id },
          url: resolved.play.url,
          started: false,
          pendingSeekSeconds: resolved.play.type === 'service' ? 0 : startSeconds,
        };
        reportState(message.session_id, { state: 'loading', position_ms: 0, duration_ms: 0 });

        const playFn = () => playerRef.current.play(resolved.play);
        if (resolved.gate === 'channel') {
          d.requestPlayChannel({ channel: resolved.channel, playFn });
        } else {
          d.requestPlayMedia({
            item: resolved.play.item,
            ratingRaw: null,
            title: d.t('parental.restrictedTitle', { defaultValue: 'Contenido restringido' }),
            message: d.t('parental.restrictedMessage', {
              defaultValue: 'Ingresa el PIN para reproducir contenido restringido por clasificación.',
            }),
            playFn,
          });
        }
        return;
      }

      if (message.type === 'cast.command') {
        const session = sessionRef.current;
        // Comandos de una transmisión que ya no es la vigente: se ignoran.
        if (!session || session.id !== message.session_id) return;
        const handled = applyCastCommand(message.command, message.args, p);
        if (handled) {
          // Si cortó (stop), el efecto de estado informa el idle; en el resto
          // se informa enseguida para que el controlador vea el cambio.
          if (message.command === 'stop') {
            reportState(session.id, { state: 'idle', position_ms: 0, duration_ms: 0 });
            sessionRef.current = null;
          } else {
            reportNow();
          }
        }
        return;
      }

      if (message.type === 'cast.displaced') {
        // Otro dispositivo de la cuenta tomó la transmisión: este se detiene.
        if (sessionRef.current && sessionRef.current.id === message.session_id) {
          sessionRef.current = null;
          p.stop();
        }
      }
    });

    return () => {
      unsubscribe();
      stopInit();
      sessionRef.current = null;
    };
    // `currentBrand` identifica la marca; el resto se lee por refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentBrand]);

  // Estado hacia el controlador: ante cada cambio relevante y cada 5 s.
  const { isPlaying, isLoading, error, url, duration } = player.state || {};
  useEffect(() => {
    if (!enabled) return;
    const session = sessionRef.current;
    if (!session) return;

    // Búsqueda inicial (VOD/catchup): una sola vez, cuando ya hay duración.
    if (session.started && session.pendingSeekSeconds > 0 && duration > 0) {
      const target = session.pendingSeekSeconds;
      session.pendingSeekSeconds = 0;
      playerRef.current.seek(target);
    }
    reportNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isPlaying, isLoading, error, url, duration, player.tracks]);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => reportNow(), STATE_REPORT_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

export default useCastReceiver;
