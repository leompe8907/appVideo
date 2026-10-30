import {getCurrentEpgEvent, getEpgEventTimeBoundsMs, getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {getEventDescription} from '@appvideo/core/utils/catchupEvent';

function pad(n) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Programa al aire y el siguiente de un canal (con `epgItems` ya cargados).
 * @returns {{ current: {title: string, time: string, progress: number, description: string} | null, next: {title: string, time: string, description: string} | null }}
 */
export function getNowNext(channel) {
  const items = channel?.epgItems;
  const current = getCurrentEpgEvent(items);
  if (!current) return {current: null, next: null};
  const bounds = getEpgEventTimeBoundsMs(current);
  const now = Date.now();
  const progress = bounds ? Math.min(1, Math.max(0, (now - bounds.startMs) / (bounds.endMs - bounds.startMs))) : 0;
  const index = items.indexOf(current);
  const nextEvent = index >= 0 ? items[index + 1] : null;
  const nextBounds = getEpgEventTimeBoundsMs(nextEvent);
  return {
    current: {
      title: getEpgEventTitle(current),
      time: bounds ? `${formatTime(bounds.startMs)} – ${formatTime(bounds.endMs)}` : '',
      progress,
      description: getEventDescription(current) || '',
    },
    next: nextEvent
      ? {
          title: getEpgEventTitle(nextEvent),
          time: nextBounds ? formatTime(nextBounds.startMs) : '',
          description: getEventDescription(nextEvent) || '',
        }
      : null,
  };
}
