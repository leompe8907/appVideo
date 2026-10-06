import * as React from 'react';
import {useEffect, useState} from 'react';
import {Image, Pressable, Text, View} from 'react-native';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {buildChannelLogoUrl, getChannelLayoutVariant} from '@appvideo/core/utils/bouquetLayoutConfig';
import {getCurrentEpgEvent, getEpgEventTimeBoundsMs, getEpgEventTitle} from '@appvideo/core/utils/epgCurrentEvent';
import {FocusRing} from '../components/FocusRing';
import {formatTime} from '../epg';
import {getTheme} from '../theme';
import {createScaledStyles, px} from '../scaledStyles';

/** Ancho de celda por card_design (bouquetLayoutClasses.js de la web, spec §2.4). */
export function cellWidthFor(cardDesign) {
  const v = String(cardDesign || '').toLowerCase();
  if (/logo_large|logo_grande/.test(v)) return 256;
  if (/event_large|full_width_line/.test(v)) return 288;
  if (/logo_with_number|logo\+lcn/.test(v)) return 200;
  return 224;
}

function useLogoSource(channel, logoIndex) {
  const theme = getTheme();
  const url = buildChannelLogoUrl(channel, getActiveBrandConfig()?.drm, logoIndex) || channel?.img;
  return url ? {uri: url} : theme.assets.placeholder;
}

function nowInfo(channel) {
  const event = getCurrentEpgEvent(channel?.epgItems);
  if (!event) return null;
  const bounds = getEpgEventTimeBoundsMs(event);
  const now = Date.now();
  return {
    title: getEpgEventTitle(event),
    time: bounds ? `${formatTime(bounds.startMs)} – ${formatTime(bounds.endMs)}` : '',
    progress: bounds ? Math.min(1, Math.max(0, (now - bounds.startMs) / (bounds.endMs - bounds.startMs))) : 0,
    image: event.imageUrl || event.imageUrl2 || event.catchupImageUrl || channel.eventImage || channel.currentEvent?.image || null,
  };
}

function Progress({value, color}) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: `${Math.round(value * 100)}%`, backgroundColor: color}]} />
    </View>
  );
}

/**
 * Tarjeta de canal del muro de bouquets (BouquetLayouts.jsx de la web).
 * El anillo de foco rodea el marco de la tarjeta, sin escala.
 */
export function ChannelCard({channel, cardDesign, logoIndex, backgroundColor, onPress, onFocus, hasTVPreferredFocus}) {
  const theme = getTheme();
  const variant = getChannelLayoutVariant(cardDesign);
  const width = cellWidthFor(cardDesign);
  const logo = useLogoSource(channel, logoIndex);
  const [focused, setFocused] = useState(false);
  const [, setTick] = useState(0);

  // Como en la web: el progreso se recalcula cada 1 s sólo mientras tiene foco.
  useEffect(() => {
    if (!focused || !/event/.test(variant)) return undefined;
    const timer = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [focused, variant]);

  const pressableProps = {
    onPress,
    hasTVPreferredFocus,
    onFocus: () => {
      setFocused(true);
      onFocus?.();
    },
    onBlur: () => setFocused(false),
  };
  const channelBg = channel?.backgroundColor || channel?.bgColor;
  const now = /event/.test(variant) ? nowInfo(channel) : null;

  if (variant === 'logo_with_number') {
    return (
      <Pressable {...pressableProps} style={[styles.card, {width: px(width)}]}>
        <View>
          <View style={[styles.lwnFrame, {backgroundColor: channelBg || '#152a52'}]}>
            <Image source={logo} style={styles.lwnLogo} resizeMode="contain" />
            {channel?.lcn != null ? <Text style={styles.lwnNumber}>{channel.lcn}</Text> : null}
          </View>
          <FocusRing visible={focused} radius={16} />
        </View>
        <Text style={styles.lwnName} numberOfLines={1}>
          {channel?.name}
        </Text>
      </Pressable>
    );
  }

  if (variant === 'event_and_logo') {
    return (
      <Pressable {...pressableProps} style={[styles.card, {width: px(width)}]}>
        <View>
          <View style={styles.ealFrame}>
            <View style={[styles.logoTop, {backgroundColor: backgroundColor || '#0a0a0a'}]}>
              <Image source={logo} style={styles.logoTopImage} resizeMode="contain" />
            </View>
            <View style={styles.eventBlock}>
              <Image source={now?.image ? {uri: now.image} : logo} style={styles.eventImage} resizeMode="stretch" />
            </View>
            <View style={styles.progressStrip}>
              <Progress value={now?.progress || 0} color={theme.timeshipColor} />
            </View>
          </View>
          <FocusRing visible={focused} radius={20} />
        </View>
        {now ? (
          <>
            <Text style={styles.eventTime}>{now.time}</Text>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {now.title}
            </Text>
          </>
        ) : null}
      </Pressable>
    );
  }

  if (variant === 'event_and_logo_overlay') {
    return (
      <Pressable {...pressableProps} style={[styles.card, {width: px(width)}]}>
        <View>
          <View style={[styles.overlayFrame]}>
            <View style={[styles.logoTop, {backgroundColor: '#0a0a0a'}]}>
              <Image source={logo} style={styles.logoTopImage} resizeMode="contain" />
            </View>
            <Image source={now?.image ? {uri: now.image} : logo} style={styles.overlayImage} resizeMode="stretch" />
            <View style={styles.overlayInfo}>
              {now ? <Text style={styles.eventTime}>{now.time}</Text> : null}
              {now ? (
                <Text style={styles.overlayTitle} numberOfLines={2}>
                  {now.title}
                </Text>
              ) : null}
              <Progress value={now?.progress || 0} color={theme.timeshipColor} />
            </View>
          </View>
          <FocusRing visible={focused} radius={20} />
        </View>
      </Pressable>
    );
  }

  // logo / event / event_line: tarjeta de 208 de alto con radio 48.
  const isEvent = variant === 'event' || variant === 'event_line';
  return (
    <Pressable {...pressableProps} style={[styles.card, {width: px(width)}]}>
      <View>
        <View style={[styles.logoCard, {backgroundColor: channelBg || 'rgba(255,255,255,0.04)'}]}>
          <Image
            source={isEvent && now?.image ? {uri: now.image} : logo}
            style={styles.fill}
            resizeMode={isEvent && now?.image ? 'cover' : 'contain'}
          />
        </View>
        <FocusRing visible={focused} radius={48} />
      </View>
    </Pressable>
  );
}

// Medidas de _bouquet.scss a 1920×1080 (spec §2.4).
const styles = createScaledStyles({
  card: {marginBottom: 32},
  fill: {width: '100%', height: '100%'},
  logoCard: {height: 208, borderRadius: 48, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden'},
  lwnFrame: {
    height: 160,
    borderRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 11.2,
    paddingBottom: 18.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lwnLogo: {width: '82%', height: '78%'},
  lwnNumber: {position: 'absolute', right: 8.8, bottom: 5.6, color: '#fff', fontSize: 23.2, fontWeight: '600', fontVariant: ['tabular-nums']},
  lwnName: {marginTop: 6.4, color: '#fff', fontSize: 14.1, fontWeight: '500'},
  ealFrame: {borderWidth: 2, borderColor: '#fff', borderRadius: 20, overflow: 'hidden'},
  overlayFrame: {height: 208, borderWidth: 2, borderColor: 'transparent', borderRadius: 20, overflow: 'hidden', backgroundColor: '#000'},
  logoTop: {height: 48, paddingVertical: 4, paddingHorizontal: 8},
  logoTopImage: {width: '100%', height: '100%'},
  eventBlock: {height: 128, backgroundColor: '#000'},
  eventImage: {width: '100%', height: '100%'},
  progressStrip: {backgroundColor: '#000', paddingTop: 5.6, paddingHorizontal: 8, paddingBottom: 6.4},
  progressTrack: {height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden'},
  progressFill: {height: '100%', borderRadius: 2},
  eventTime: {marginTop: 6, paddingHorizontal: 8, color: 'rgba(255,255,255,0.9)', fontSize: 19.2, fontVariant: ['tabular-nums']},
  eventTitle: {paddingHorizontal: 8, color: '#fcfafa', fontSize: 19.2, fontWeight: '600'},
  overlayImage: {flex: 1, width: '100%'},
  overlayInfo: {position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.75)'},
  overlayTitle: {paddingHorizontal: 8, marginBottom: 6, color: '#fff', fontSize: 19.2, fontWeight: '500'},
});
