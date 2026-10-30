import {getChannelStableId} from '@appvideo/core/utils/channelId';
import {getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {asMs} from '@appvideo/core/utils/epgSlots';

/** Id del recordatorio de un evento de la Guía (lo usan la Guía y el buscador). */
export function reminderIdFor(event) {
  return String(event?.event_id ?? event?.eventId ?? event?.id);
}

/** Recordatorio para `epgReminderStore.addReminder`. */
export function buildEventReminder(channel, event) {
  return {
    id: reminderIdFor(event),
    eventId: event?.event_id ?? event?.eventId ?? event?.id,
    title: getEpgEventTitle(event),
    startMs: asMs(event?.startDate) ?? asMs(event?.start),
    channelStableId: getChannelStableId(channel),
  };
}
