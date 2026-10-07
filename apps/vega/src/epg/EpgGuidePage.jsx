import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {BackHandler, FlatList, Image, Pressable, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useEpgReminderStore} from '@appvideo/core/store/epgReminderStore';
import {dedupeStreams, getChannelStableId} from '@appvideo/core/utils/channelId';
import {buildChannelLogoUrl} from '@appvideo/core/utils/bouquetLayoutConfig';
import {getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {asMs, computeSlots} from '@appvideo/core/utils/epgSlots';
import {EpgEventModal} from './EpgEventModal';
import {RemoteImage} from '../components/RemoteImage';
import {FocusRing} from '../components/FocusRing';
import {formatTime} from '../epg';
import {getTheme} from '../theme';
import {createScaledStyles, px} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const startOf = (ev) => asMs(ev?.startDate) ?? asMs(ev?.start);
const endOf = (ev) => asMs(ev?.endDate) ?? asMs(ev?.end);

function ProgramCard({event, live, nowMs, colors, onPress, fallbackTitle, hasTVPreferredFocus}) {
  const [focused, setFocused] = useState(false);
  const enabled = Boolean(event) || Boolean(fallbackTitle);
  const start = startOf(event);
  const end = endOf(event);
  const progress = live && start != null && end != null ? Math.min(1, Math.max(0, (nowMs - start) / (end - start))) : 0;
  return (
    <View style={styles.slot}>
      <Pressable
        disabled={!enabled}
        focusable={enabled}
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.card, live && {backgroundColor: colors.liveBg}, !enabled && styles.disabled]}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event ? getEpgEventTitle(event) || '—' : fallbackTitle || '—'}
        </Text>
        {start != null && end != null ? <Text style={styles.cardTime}>{`${formatTime(start)} - ${formatTime(end)}`}</Text> : null}
        {live ? (
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${Math.round(progress * 100)}%`, backgroundColor: colors.progress}]} />
          </View>
        ) : null}
      </Pressable>
      <FocusRing visible={focused} radius={14} />
    </View>
  );
}

/**
 * Guía de canales (EpgCards de la web, spec 3 §4): tabla de canales × slots
 * relativos a ahora ([Antes] · Ahora · Siguiente · Más tarde), refrescada
 * cada 15 s. OK abre el detalle con Reproducir en vivo / Ver catchup /
 * Recordarme. Sólo para marcas con EPG.enabled (intv lo tiene apagado).
 */
export function EpgGuidePage({onPlayChannel, onPlayCatchup, onModalChange, active = true}) {
  const theme = getTheme();
  const brand = getActiveBrandConfig();
  const epgCfg = brand?.EPG || {};
  const epgPast = epgCfg.epgPast === true;
  const colors = {
    headerBg: epgCfg.epgCardsHeaderBg || 'rgb(0,0,0)',
    channelActiveBg: epgCfg.epgCardsChannelActiveBg || 'rgba(10,67,133,0.3)',
    liveBg: epgCfg.epgCardsProgramLiveBg || 'rgba(255,255,255,0.12)',
    progress: epgCfg.epgCardsProgramLiveProgressBg || theme.secondary,
  };
  const streams = usePreloadStore((s) => s.epg.streams);
  const reminders = useEpgReminderStore((s) => s.reminders);
  const addReminder = useEpgReminderStore((s) => s.addReminder);
  const removeReminder = useEpgReminderStore((s) => s.removeReminder);
  const [nowMs, setNowMs] = useState(Date.now());
  const [detail, setDetail] = useState(null); // {channel, event, isLive}

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onModalChange?.(Boolean(detail));
  }, [detail, onModalChange]);

  useEffect(() => {
    if (!active || !detail) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetail(null);
      return true;
    });
    return () => sub.remove();
  }, [active, detail]);

  const channels = useMemo(() => dedupeStreams(streams || []).sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0)), [streams]);
  const slotKeys = epgPast ? ['before', 'now', 'next', 'later'] : ['now', 'next', 'later'];
  const slotLabel = {before: t('epg.before'), now: t('epg.now'), next: t('epg.next'), later: t('epg.later')};

  const reminderId = (event) => String(event?.event_id ?? event?.eventId ?? event?.id);

  const header = (
    <View style={[styles.tableHeader, {backgroundColor: colors.headerBg}]}>
      <Text style={[styles.headerCell, styles.channelCol]}>{t('epg.channel')}</Text>
      {slotKeys.map((k) => (
        <Text key={k} style={[styles.headerCell, styles.slot]} numberOfLines={1}>
          {slotLabel[k]}
        </Text>
      ))}
    </View>
  );

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{t('epg.title')}</Text>
      <Text style={styles.subtitle}>{t('epg.subtitle')}</Text>
      <FlatList
        data={channels}
        keyExtractor={(c, i) => String(getChannelStableId(c) || i)}
        ListHeaderComponent={header}
        stickyHeaderIndices={[0]}
        initialNumToRender={8}
        renderItem={({item: channel, index: row}) => {
          const slots = computeSlots(channel?.epgItems || [], {nowMs, epgPastEnabled: epgPast});
          const noEpg = !slots.now && Boolean(channel?.url);
          const logo = buildChannelLogoUrl(channel, brand?.drm) || channel?.img;
          const activeRow = slots.isLive || noEpg;
          return (
            <View style={styles.row}>
              <View style={[styles.channelCol, styles.channelCell, activeRow && {backgroundColor: colors.channelActiveBg, padding: px(8), borderRadius: px(14)}]}>
                {channel?.lcn != null ? <Text style={styles.lcn}>{channel.lcn}</Text> : null}
                <RemoteImage uri={logo} style={styles.logo} resizeMode="contain" />
                <Text style={styles.channelName} numberOfLines={1}>
                  {channel?.name}
                </Text>
              </View>
              {slotKeys.map((k) => {
                const event = slots[k];
                const live = k === 'now' && (slots.isLive || noEpg);
                return (
                  <ProgramCard
                    key={k}
                    event={event}
                    live={live}
                    nowMs={nowMs}
                    colors={colors}
                    fallbackTitle={k === 'now' && noEpg ? channel?.name || t('epg.playLiveChannel') : null}
                    hasTVPreferredFocus={active && !detail && row === 0 && k === 'now'}
                    onPress={() => {
                      if (!event) {
                        onPlayChannel(channel);
                        return;
                      }
                      setDetail({channel, event, isLive: live});
                    }}
                  />
                );
              })}
            </View>
          );
        }}
      />
      {detail ? (
        <EpgEventModal
          context="epg"
          channel={detail.channel}
          event={detail.event}
          isLive={detail.isLive}
          reminded={reminders.some((r) => r.id === reminderId(detail.event))}
          onPlayLive={() => {
            const ch = detail.channel;
            setDetail(null);
            onPlayChannel(ch);
          }}
          onPlayCatchup={(event) => {
            setDetail(null);
            onPlayCatchup(event);
          }}
          onToggleReminder={() => {
            const id = reminderId(detail.event);
            if (reminders.some((r) => r.id === id)) removeReminder(id);
            else
              addReminder({
                id,
                eventId: detail.event?.event_id ?? detail.event?.eventId ?? detail.event?.id,
                title: getEpgEventTitle(detail.event),
                startMs: startOf(detail.event),
                channelStableId: getChannelStableId(detail.channel),
              });
          }}
        />
      ) : null}
    </View>
  );
}

// epg-common.scss / _epg.scss a 1920×1080 (spec 3 §4.2).
const styles = createScaledStyles({
  page: {flex: 1, padding: 32},
  title: {color: '#fff', fontSize: 22, fontWeight: '800', paddingTop: 18, paddingHorizontal: 18},
  subtitle: {color: 'rgba(255,255,255,0.7)', fontSize: 14, paddingHorizontal: 18, paddingBottom: 10, marginTop: 6},
  tableHeader: {flexDirection: 'row', alignItems: 'center', gap: 14, height: 80, borderRadius: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)'},
  headerCell: {color: 'rgba(255,255,255,0.6)', fontSize: 32, fontWeight: '700', textAlign: 'center'},
  channelCol: {width: 200},
  row: {flexDirection: 'row', gap: 14, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)'},
  channelCell: {alignItems: 'center', justifyContent: 'center', gap: 6},
  lcn: {color: 'rgba(255,255,255,0.7)', fontSize: 24},
  logo: {width: 128, height: 96, borderRadius: 12},
  channelName: {color: '#fff', fontSize: 24, fontWeight: '700'},
  slot: {flex: 1},
  card: {minHeight: 92, padding: 12, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.06)'},
  disabled: {opacity: 0.35},
  cardTitle: {color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 28.8},
  cardTime: {color: 'rgba(255,255,255,0.75)', fontSize: 16},
  track: {marginTop: 'auto', height: 9.6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 999},
});
