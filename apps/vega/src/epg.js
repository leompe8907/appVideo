import {getCurrentEpgEvent, getEpgEventTimeBoundsMs} from '@appvideo/core/utils/epgCurrentEvent';

function pad(n) {
  return n < 10 ? `0${n}` : String(n);
}

export function formatTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Programa al aire y el siguiente de un canal (con `epgItems` ya cargados).
 * @returns {{ current: {title: string, time: string, progress: number} | null, next: {title: string, time: string} | null }}
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
      title: current.title || '',
      time: bounds ? `${formatTime(bounds.startMs)} – ${formatTime(bounds.endMs)}` : '',
      progress,
    },
    next: nextEvent ? {title: nextEvent.title || '', time: nextBounds ? formatTime(nextBounds.startMs) : ''} : null,
  };
}
