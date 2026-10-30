import * as React from 'react';
import {useEffect, useState} from 'react';
import {Modal, Pressable, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useEpgReminderStore} from '@appvideo/core/store/epgReminderStore';
import {getChannelStableId} from '@appvideo/core/utils/channelId';
import {FocusRing} from '../components/FocusRing';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key) => i18n.t(key);

function Btn({label, primary, onPress, hasTVPreferredFocus, disabled}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.btn, primary ? {backgroundColor: theme.primary} : styles.btnSecondary, disabled && styles.disabled]}>
        <Text style={[styles.btnText, primary && styles.btnTextPrimary]}>{label}</Text>
      </Pressable>
      <FocusRing visible={focused} radius={12} />
    </View>
  );
}

const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Aviso de programa por comenzar (EpgReminderHost de la web, spec 3 §4.5):
 * ventana de `EPG.reminderLeadSeconds` antes del inicio; con el reproductor
 * abierto sólo si `EPG.reminderShowWhilePlaying`. "Cerrar" lo descarta hasta
 * el inicio; "Ir al canal" lo borra y reproduce el canal.
 */
export function ReminderHost({playerActive, onGoToChannel}) {
  const epgCfg = getActiveBrandConfig()?.EPG || {};
  const leadMs = Math.max(5, Number(epgCfg.reminderLeadSeconds) || 60) * 1000;
  const showWhilePlaying = epgCfg.reminderShowWhilePlaying === true;
  const reminders = useEpgReminderStore((s) => s.reminders);
  const isDismissed = useEpgReminderStore((s) => s.isDismissed);
  const dismissUntil = useEpgReminderStore((s) => s.dismissReminderUntil);
  const removeReminder = useEpgReminderStore((s) => s.removeReminder);
  const streams = usePreloadStore((s) => s.epg.streams);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!reminders?.length) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [reminders?.length]);

  if (playerActive && !showWhilePlaying) return null;
  const due = (reminders || [])
    .filter((r) => Number.isFinite(r.startMs) && now >= r.startMs - leadMs && now < r.startMs && !isDismissed(r.id, now))
    .sort((a, b) => a.startMs - b.startMs)[0];
  if (!due) return null;
  const channel = (streams || []).find((s) => getChannelStableId(s) === due.channelStableId);

  return (
    <Modal transparent visible onRequestClose={() => dismissUntil(due.id, due.startMs)}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.heading}>{t('epg.reminderTitle')}</Text>
          <Text style={styles.meta}>{t('epg.reminderStartingSoon')}</Text>
          <Text style={styles.title}>{due.title || t('epg.eventNoTitle')}</Text>
          <Text style={styles.badge}>{`${t('epg.reminderStartsIn')} ${mmss(due.startMs - now)}`}</Text>
          {channel?.name ? <Text style={styles.channel}>{channel.name}</Text> : null}
          <View style={styles.footer}>
            <Btn label={t('common.close')} onPress={() => dismissUntil(due.id, due.startMs)} />
            <Btn
              label={t('epg.goToChannel')}
              primary
              hasTVPreferredFocus
              disabled={!channel}
              onPress={() => {
                removeReminder(due.id);
                onGoToChannel?.(channel);
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = createScaledStyles({
  overlay: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)'},
  box: {width: 1152, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgb(20,20,20)', gap: 12},
  heading: {color: '#fff', fontSize: 40, fontWeight: '700'},
  meta: {color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '700'},
  title: {color: '#fff', fontSize: 40, fontWeight: '700'},
  badge: {alignSelf: 'flex-start', color: '#fff', fontSize: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)'},
  channel: {color: 'rgba(255,255,255,0.85)', fontSize: 20.8},
  footer: {flexDirection: 'row', gap: 12, marginTop: 8},
  btn: {paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12},
  btnSecondary: {backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)'},
  btnText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  btnTextPrimary: {color: '#000'},
  disabled: {opacity: 0.5},
});
