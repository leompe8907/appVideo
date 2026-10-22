import * as React from 'react';
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, FlatList, Image, Pressable, TVFocusGuideView, Text, View, useTVEventHandler} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useEpgReminderStore} from '@appvideo/core/store/epgReminderStore';
import {dedupeStreams, getChannelStableId} from '@appvideo/core/utils/channelId';
import {buildChannelLogoUrl} from '@appvideo/core/utils/bouquetLayoutConfig';
import {getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {asMs, computeSlots} from '@appvideo/core/utils/epgSlots';
import {EpgEventModal} from './EpgEventModal';
import {buildEventReminder, reminderIdFor} from './reminders';
import {RemoteImage} from '../components/RemoteImage';
import {FocusRing} from '../components/FocusRing';
import {formatTime} from '../epg';
import {getTheme} from '../theme';
import {createScaledStyles, px} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const startOf = (ev) => asMs(ev?.startDate) ?? asMs(ev?.start);
const endOf = (ev) => asMs(ev?.endDate) ?? asMs(ev?.end);

function ProgramCard({event, live, nowMs, colors, onPress, hasTVPreferredFocus, onFocusChange, pageable, trapLeft, trapRight, hint}) {
  const [focused, setFocused] = useState(false);
  const enabled = Boolean(event);
  const start = startOf(event);
  const end = endOf(event);
  const progress = live && start != null && end != null ? Math.min(1, Math.max(0, (nowMs - start) / (end - start))) : 0;
  // Sólo "Antes"/"Más tarde" necesitan la guía de foco (trapLeft/trapRight:
  // ◄/► pagina la columna en vez de mover el foco); el resto, un View común.
  const Container = pageable ? TVFocusGuideView : View;
  const trap = pageable ? {trapFocusLeft: Boolean(trapLeft), trapFocusRight: Boolean(trapRight)} : null;
  return (
    <Container style={styles.slot} {...trap}>
      <Pressable
        disabled={!enabled}
        focusable={enabled}
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => {
          setFocused(false);
          onFocusChange?.(false);
        }}
        style={[styles.card, live && {backgroundColor: colors.liveBg}, !enabled && styles.disabled]}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event ? getEpgEventTitle(event) || '—' : '—'}
        </Text>
        {start != null && end != null ? <Text style={styles.cardTime}>{`${formatTime(start)} - ${formatTime(end)}`}</Text> : null}
        {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
        {live ? (
          <View style={styles.track}>
            <View style={[styles.fill, {width: `${Math.round(progress * 100)}%`, backgroundColor: colors.progress}]} />
          </View>
        ) : null}
      </Pressable>
      <FocusRing visible={focused} radius={14} />
    </Container>
  );
}

const NO_PAGING = {before: 0, later: 0};
// Alto fijo de fila (a 1920): permite getItemLayout, así la lista no mide
// cada fila al desplazarse. Entra la celda del canal resaltada (con padding).
const ROW_HEIGHT = 204;

/**
 * Fila de un canal. ◄ en "Antes" muestra el evento anterior y ► lo vuelve
 * hacia ahora (si epgPagesPastEnabled); ► en "Más tarde" muestra el siguiente
 * y ◄ vuelve. Con epgCardsPastGlobal / epgCardsLaterGlobal se mueve la columna
 * entera (`globalOffsets` de la guía, cada fila acotada a sus datos); si no,
 * solo esta fila, y su paginado vuelve a cero cuando cambia el evento al aire.
 * En el evento más viejo, ◄ sale de la guía como siempre.
 *
 * Las teclas las recibe un único manejador en la guía (`keyTargetRef`): la fila
 * con foco se anota ahí. El foco se sigue con refs para no redibujar la fila
 * en cada movimiento.
 */
const GuideRow = memo(function GuideRow({channel, nowMs, epgPast, pagePast, global, globalOffsets, onGlobalPage, slotKeys, colors, drm, preferredSlot, onPlayChannel, onOpen, keyTargetRef}) {
  const [paging, setPaging] = useState({liveKey: null, ...NO_PAGING});
  const [atEnd, setAtEnd] = useState(false);
  const focusedSlotRef = useRef(null);
  const handleKeyRef = useRef(null);
  const items = channel?.epgItems || [];
  const base = computeSlots(items, {nowMs, epgPastEnabled: epgPast});
  const liveKey = startOf(base.now) ?? null;
  const local = paging.liveKey === liveKey ? paging : NO_PAGING;
  const requested = {
    before: global.before ? globalOffsets.before : local.before,
    later: global.later ? globalOffsets.later : local.later,
  };
  const slots =
    requested.before || requested.later
      ? computeSlots(items, {nowMs, epgPastEnabled: epgPast, beforeOffset: requested.before, laterOffset: requested.later})
      : base;
  const canPageBefore = pagePast && slots.canPageBefore;
  const offsetOf = {before: slots.beforeOffset, later: slots.laterOffset};

  useEffect(() => {
    if (!atEnd) return undefined;
    const timer = setTimeout(() => setAtEnd(false), 2000);
    return () => clearTimeout(timer);
  }, [atEnd]);

  // Desde lo que muestra esta fila (acotado), así una columna global no "salta".
  const page = (column, delta) => {
    const value = offsetOf[column] + delta;
    if (global[column]) onGlobalPage(column, value);
    else setPaging({liveKey, ...local, [column]: value});
  };

  const handleKey = (evt) => {
    if (focusedSlotRef.current === 'before') {
      if (evt.eventType === 'left' && canPageBefore) page('before', 1);
      if (evt.eventType === 'right' && offsetOf.before > 0) page('before', -1);
    } else if (focusedSlotRef.current === 'later') {
      if (evt.eventType === 'right') {
        if (slots.canPageLater) page('later', 1);
        else setAtEnd(true);
      }
      if (evt.eventType === 'left' && offsetOf.later > 0) page('later', -1);
    }
  };
  useEffect(() => {
    handleKeyRef.current = handleKey;
  });
  const onCardFocus = (k, focused) => {
    if (focused) {
      focusedSlotRef.current = k;
      keyTargetRef.current = handleKeyRef;
    } else if (focusedSlotRef.current === k) {
      focusedSlotRef.current = null;
      if (keyTargetRef.current === handleKeyRef) keyTargetRef.current = null;
    }
  };
  const logo = buildChannelLogoUrl(channel, drm) || channel?.img;

  const noEpg = !slots.now;
  const activeRow = slots.isLive || (noEpg && Boolean(channel?.url));
  return (
    <View style={styles.row}>
      <View style={[styles.channelCol, styles.channelCell, activeRow && {backgroundColor: colors.channelActiveBg, padding: px(8), borderRadius: px(14)}]}>
        {channel?.lcn != null ? <Text style={styles.lcn}>{channel.lcn}</Text> : null}
        <RemoteImage uri={logo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.channelName} numberOfLines={1}>
          {channel?.name}
        </Text>
      </View>
      {noEpg ? (
        <NoEpgNotice
          failed={channel?.epgLoadFailed === true}
          onPlay={channel?.url ? () => onPlayChannel(channel) : null}
          hasTVPreferredFocus={preferredSlot === 'now'}
        />
      ) : (
        slotKeys.map((k) => {
          const event = slots[k];
          const live = k === 'now' && slots.isLive;
          return (
            <ProgramCard
              key={k}
              event={event}
              live={live}
              nowMs={nowMs}
              colors={colors}
              hasTVPreferredFocus={preferredSlot === k}
              onFocusChange={(focused) => onCardFocus(k, focused)}
              pageable={k === 'before' || k === 'later'}
              trapLeft={(k === 'before' && canPageBefore) || (k === 'later' && offsetOf.later > 0)}
              trapRight={(k === 'before' && offsetOf.before > 0) || k === 'later'}
              hint={k === 'later' && atEnd ? t('epg.noMorePrograms') : null}
              onPress={() => onOpen({channel, event, isLive: live}, k)}
            />
          );
        })
      )}
    </View>
  );
});

/**
 * Fila de un canal sin programación (como DevApps): ocupa todas las columnas,
 * distingue "sin EPG" de "falló la carga" (`epgLoadFailed`) y deja ver el
 * canal en vivo.
 */
function NoEpgNotice({failed, onPlay, hasTVPreferredFocus}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.card, styles.notice]}>
      <View style={styles.noticeText}>
        <Text style={styles.cardTitle}>{t(failed ? 'epg.loadErrorTitle' : 'epg.noEpgTitle')}</Text>
        <Text style={styles.cardTime}>{t(failed ? 'epg.loadErrorMessage' : 'epg.noEpgMessage')}</Text>
      </View>
      {onPlay ? (
        <View>
          <Pressable
            onPress={onPlay}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.watchButton}>
            <Text style={styles.watchText}>{t('epg.watchLive')}</Text>
          </Pressable>
          <FocusRing visible={focused} radius={999} />
        </View>
      ) : null}
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
  const epgCfg = useMemo(() => brand?.EPG || {}, [brand]);
  const epgPast = epgCfg.epgPast === true;
  const pagePast = epgPast && epgCfg.epgPagesPastEnabled === true;
  // Props estables para que las filas (memo) no se redibujen sin cambios.
  const global = useMemo(() => ({before: epgCfg.epgCardsPastGlobal === true, later: epgCfg.epgCardsLaterGlobal === true}), [epgCfg]);
  const colors = useMemo(
    () => ({
      headerBg: epgCfg.epgCardsHeaderBg || 'rgb(0,0,0)',
      channelActiveBg: epgCfg.epgCardsChannelActiveBg || 'rgba(10,67,133,0.3)',
      liveBg: epgCfg.epgCardsProgramLiveBg || 'rgba(255,255,255,0.12)',
      progress: epgCfg.epgCardsProgramLiveProgressBg || theme.secondary,
    }),
    [epgCfg, theme.secondary],
  );
  const streams = usePreloadStore((s) => s.epg.streams);
  const reminders = useEpgReminderStore((s) => s.reminders);
  const addReminder = useEpgReminderStore((s) => s.addReminder);
  const removeReminder = useEpgReminderStore((s) => s.removeReminder);
  const [nowMs, setNowMs] = useState(Date.now());
  const [detail, setDetail] = useState(null); // {channel, event, isLive}
  // Tarjeta que abrió el detalle: al cerrarlo el foco vuelve ahí y no al
  // "Ahora" del primer canal (que sólo es el foco inicial de la guía).
  const [lastOpened, setLastOpened] = useState(null); // {id, slot}
  const [globalOffsets, setGlobalOffsets] = useState(NO_PAGING);
  const keyTargetRef = useRef(null); // handleKeyRef de la fila con foco
  const playRef = useRef(onPlayChannel);
  useEffect(() => {
    playRef.current = onPlayChannel;
  });
  const playChannel = useCallback((ch) => playRef.current(ch), []);
  const onGlobalPage = useCallback((column, value) => setGlobalOffsets((o) => ({...o, [column]: value})), []);
  const onOpen = useCallback((next, slot) => {
    setLastOpened({id: getChannelStableId(next.channel), slot});
    setDetail(next);
  }, []);

  useTVEventHandler((evt) => {
    if (!active || detail || !evt || evt.eventKeyAction === 1) return;
    keyTargetRef.current?.current?.(evt);
  });

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
  const slotKeys = useMemo(() => (epgPast ? ['before', 'now', 'next', 'later'] : ['now', 'next', 'later']), [epgPast]);
  const slotLabel = {before: t('epg.before'), now: t('epg.now'), next: t('epg.next'), later: t('epg.later')};


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
      {/* Fuera de la lista: como header sticky, al llevar el foco a la primera
          fila la lista se desplazaba sin contarlo y la fila quedaba tapada. */}
      {header}
      <FlatList
        data={channels}
        keyExtractor={(c, i) => String(getChannelStableId(c) || i)}
        // Pocas filas montadas: cada una son ~20 vistas nativas y un logo.
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        getItemLayout={(_, index) => ({length: px(ROW_HEIGHT), offset: px(ROW_HEIGHT) * index, index})}
        renderItem={({item: channel, index: row}) => (
          <GuideRow
            channel={channel}
            nowMs={nowMs}
            epgPast={epgPast}
            pagePast={pagePast}
            global={global}
            globalOffsets={globalOffsets}
            onGlobalPage={onGlobalPage}
            slotKeys={slotKeys}
            colors={colors}
            drm={brand?.drm}
            preferredSlot={
              !active || detail ? null : lastOpened ? (lastOpened.id === getChannelStableId(channel) ? lastOpened.slot : null) : row === 0 ? 'now' : null
            }
            onPlayChannel={playChannel}
            onOpen={onOpen}
            keyTargetRef={keyTargetRef}
          />
        )}
      />
      {detail ? (
        <EpgEventModal
          context="epg"
          channel={detail.channel}
          event={detail.event}
          isLive={detail.isLive}
          reminded={reminders.some((r) => r.id === reminderIdFor(detail.event))}
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
            const id = reminderIdFor(detail.event);
            if (reminders.some((r) => r.id === id)) removeReminder(id);
            else addReminder(buildEventReminder(detail.channel, detail.event));
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
  row: {height: ROW_HEIGHT, flexDirection: 'row', gap: 14, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)'},
  channelCell: {alignItems: 'center', justifyContent: 'center', gap: 6},
  lcn: {color: 'rgba(255,255,255,0.7)', fontSize: 24},
  logo: {width: 128, height: 96, borderRadius: 12},
  channelName: {color: '#fff', fontSize: 24, fontWeight: '700'},
  slot: {flex: 1},
  // flex: 1 → alto de la fila (lo marca la celda del canal), igual que el anillo de foco.
  card: {flex: 1, minHeight: 92, padding: 12, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.06)'},
  disabled: {opacity: 0.35},
  notice: {flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 24},
  noticeText: {flex: 1, gap: 8},
  watchButton: {paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)'},
  watchText: {color: '#fff', fontSize: 20, fontWeight: '700'},
  cardTitle: {color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 28.8},
  cardTime: {color: 'rgba(255,255,255,0.75)', fontSize: 16},
  cardHint: {color: 'rgba(255,255,255,0.6)', fontSize: 16, fontStyle: 'italic'},
  track: {marginTop: 'auto', height: 9.6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden'},
  fill: {height: '100%', borderRadius: 999},
});
