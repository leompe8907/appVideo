import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useBrand } from '../../contexts/BrandContext';
import { usePreload } from '../../store/usePreload';
import { usePlayer } from '../../contexts/PlayerContext';
import { useDevice } from '../../contexts/DeviceContext';
import panaccessService from '../../services/panaccessService';
import { FocusableButton } from '../navigation/FocusableButton';
import { useParentalGate } from '../../hooks/useParentalGate';
import { useEpgReminderStore } from '../../store/epgReminderStore';
import { getChannelStableId } from '../../utils/channelId';
import AppIcon from '../AppIcon';

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function resolveChannelLiveUrl(channel) {
  if (!channel) return null;
  let url = channel.url || channel.streamUrl || channel.hlsUrl || channel.hls || null;
  if (!url) {
    const streamId = channel.id ?? channel.epgStreamId;
    if (streamId != null && streamId !== '') {
      try {
        url = panaccessService.getStreamM3u8Url({ streamId });
      } catch {
        // noop
      }
    }
  }
  try {
    url = panaccessService.normalizePlaybackUrl(url);
  } catch {
    // noop
  }
  return url || null;
}

export function EpgReminderHost() {
  const { t } = useTranslation();
  const { currentBrand } = useBrand();
  const { epg } = usePreload();
  const { play, state: playerState } = usePlayer();
  const { isTV } = useDevice();
  const { requestPlayChannel } = useParentalGate();

  const reminders = useEpgReminderStore((s) => s.reminders);
  const removeReminder = useEpgReminderStore((s) => s.removeReminder);
  const dismissReminderUntil = useEpgReminderStore((s) => s.dismissReminderUntil);
  const isDismissed = useEpgReminderStore((s) => s.isDismissed);

  const leadSeconds = Number(currentBrand?.EPG?.reminderLeadSeconds ?? 60) || 60;
  const leadMs = Math.max(5, leadSeconds) * 1000;
  const showWhilePlaying = currentBrand?.EPG?.reminderShowWhilePlaying === true;
  const isPlayerActive = Boolean(playerState?.url);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const due = useMemo(() => {
    if (isPlayerActive && !showWhilePlaying) return null;
    const list = Array.isArray(reminders) ? reminders : [];
    if (list.length === 0) return null;
    const eligible = list
      .map((r) => {
        const startMs = Number(r.startMs);
        if (!Number.isFinite(startMs)) return null;
        const id = String(r.id ?? '');
        const inWindow = nowMs >= startMs - leadMs && nowMs < startMs;
        if (!inWindow) return null;
        if (isDismissed?.(id, nowMs)) return null;
        return { ...r, startMs, id };
      })
      .filter(Boolean);
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => a.startMs - b.startMs);
    return eligible[0];
  }, [reminders, nowMs, leadMs, isDismissed, isPlayerActive, showWhilePlaying]);

  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    if (!due) return;
    setOpenId(due.id);
  }, [due?.id]);

  const active = due && openId === due.id ? due : null;
  const countdown = active ? formatCountdown(active.startMs - nowMs) : '00:00';
  useEffect(() => {
    if (!active || !isTV) return;
    const tm = setTimeout(() => {
      const btn = document.getElementById('epg-reminder-go');
      if (btn) btn.focus();
    }, 50);
    return () => clearTimeout(tm);
  }, [active, isTV]);

  if (!active) return null;

  const channelId = String(active.channelStableId ?? '');
  const channel =
    (epg?.streams || []).find((ch) => String(getChannelStableId(ch)) === channelId) || null;

  const close = () => {
    setOpenId(null);
    // Si el usuario cierra, hacemos snooze hasta el inicio (para no re-abrir en loop)
    dismissReminderUntil(active.id, active.startMs);
  };

  const goToChannel = () => {
    setOpenId(null);
    removeReminder(active.id);
    if (!channel) return;
    const url = resolveChannelLiveUrl(channel);
    if (!url) return;
    requestPlayChannel({
      channel,
      playFn: () => play({ type: 'service', id: channel.id ?? channel.lcn ?? undefined, url, item: channel, autoPlay: true }),
    });
  };

  return createPortal(
    <div className="epg-event-modal-overlay" role="dialog" aria-modal="true" onClick={close}>
      <div className="epg-event-modal" onClick={(e) => e.stopPropagation()}>
        <div className="epg-event-modal-header">
          <div className="epg-event-modal-header-left">
            <div className="epg-event-modal-channel-text">
              <div className="epg-event-modal-name">{t('epg.reminderTitle', { defaultValue: 'Recordatorio' })}</div>
              <div className="epg-event-modal-meta-row">
                <div className="epg-event-modal-meta-item epg-event-modal-meta-time">
                  <span className="epg-event-modal-meta-time-value">
                    {t('epg.reminderStartingSoon', { defaultValue: 'Este programa está por comenzar' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="epg-event-modal-header-right">
            <FocusableButton
              className="epg-event-modal-close"
              onClick={close}
              type="button"
            id="epg-reminder-close-x"
            >
              <AppIcon name="close" size={18} />
            </FocusableButton>
          </div>
        </div>

        <div className="epg-event-modal-body">
          <h2 className="epg-event-modal-title">{active.title || t('epg.eventNoTitle', { defaultValue: 'Sin título' })}</h2>
          <div className="epg-event-modal-live-badge">
            {t('epg.reminderStartsIn', { defaultValue: 'Comienza en' })} {countdown}
          </div>
          {channel?.name ? (
            <p className="epg-event-modal-description">{channel.name}</p>
          ) : null}
        </div>

        <div className="epg-event-modal-footer">
          <FocusableButton
            className="epg-event-modal-secondary"
            type="button"
            onClick={close}
            id="epg-reminder-close"
          >
            {t('common.close', { defaultValue: 'Cerrar' })}
          </FocusableButton>
          <FocusableButton
            className="epg-event-modal-primary"
            type="button"
            onClick={goToChannel}
            id="epg-reminder-go"
            disabled={!channel}
          >
            {t('epg.goToChannel', { defaultValue: 'Ir al canal' })}
          </FocusableButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default EpgReminderHost;

