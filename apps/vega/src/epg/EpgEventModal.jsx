import * as React from 'react';
import {useState} from 'react';
import {Image, Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getCatchupStreamId, getEventDescription, getEventEndMs, getEventImage, getEventStartMs, getEventTitle} from '@appvideo/core/utils/catchupEvent';
import {FocusRing} from '../components/FocusRing';
import {formatTime} from '../epg';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);

function Action({label, primary, onPress, hasTVPreferredFocus}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.btn, primary ? {backgroundColor: theme.primary} : styles.btnSecondary]}>
        <Text style={[styles.btnText, primary ? styles.btnTextPrimary : null]}>{label}</Text>
      </Pressable>
      <FocusRing visible={focused} radius={12} />
    </View>
  );
}

/**
 * Detalle de un programa (EpgEventModal de la web, spec 3 §2).
 * - context 'catchup': sólo "Reproducir" (si el evento tiene id de catchup).
 * - context 'epg': "Reproducir canal (en vivo)" siempre; "Ver (Catchup)" si ya
 *   pasó; "Recordarme"/"Recordado" si es futuro.
 * Atrás lo cierra el dueño del modal.
 */
export function EpgEventModal({channel, event, context, isLive, onPlayCatchup, onPlayLive, reminded, onToggleReminder}) {
  const theme = getTheme();
  const start = getEventStartMs(event);
  const end = getEventEndMs(event);
  const now = Date.now();
  const catchupId = getCatchupStreamId(event);
  const isPast = end != null ? now > end : context === 'catchup';
  const isFuture = start != null && now < start;
  const logo = channel?.img || channel?.imageUrl || channel?.logoUrl || channel?.logo || channel?.icon;
  const image = getEventImage(event);
  const rating = event?.parentalRating;
  const badge = context === 'catchup' ? 'Catchup' : isLive ? t('epg.live') : t('epg.notLive');

  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <View style={styles.header}>
          <Image source={logo ? {uri: logo} : theme.assets.placeholder} style={styles.logo} resizeMode="contain" />
          <View style={styles.headerText}>
            <Text style={styles.channel} numberOfLines={1}>
              {channel?.name || ''}
            </Text>
            <View style={styles.metaRow}>
              {channel?.lcn != null ? <Text style={styles.metaDim}>{String(channel.lcn)}</Text> : null}
              {rating ? <Text style={styles.rating}>{`+${String(rating).replace(/^\+/, '')}`}</Text> : null}
              {start != null && end != null ? <Text style={styles.meta}>{`${formatTime(start)} - ${formatTime(end)}`}</Text> : null}
              {start != null && end != null ? <Text style={styles.metaDim}>{`${Math.round((end - start) / 60000)} min`}</Text> : null}
            </View>
          </View>
          {image ? <Image source={{uri: image}} style={styles.image} resizeMode="contain" /> : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{getEventTitle(event) || t('epg.eventNoTitle')}</Text>
          <Text style={styles.badge}>{badge}</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.description}>{getEventDescription(event) || t('epg.noDescription')}</Text>
          </ScrollView>
        </View>
        <View style={styles.footer}>
          {context === 'catchup' ? (
            catchupId != null ? (
              <Action label={t('catchup.play')} hasTVPreferredFocus onPress={() => onPlayCatchup?.(event)} />
            ) : (
              <Text style={styles.notAvailable}>{t('catchup.notAvailableYet')}</Text>
            )
          ) : (
            <>
              <Action label={t('epg.playLiveChannel')} primary hasTVPreferredFocus onPress={() => onPlayLive?.()} />
              {isPast && catchupId != null ? <Action label={t('epg.watchCatchup')} onPress={() => onPlayCatchup?.(event)} /> : null}
              {isFuture ? <Action label={reminded ? t('epg.reminded') : t('epg.remindMe')} onPress={() => onToggleReminder?.()} /> : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

// epg-common.scss a 1920×1080 (spec 3 §2.1).
const styles = createScaledStyles({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center'},
  box: {width: 1152, height: 864, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgb(20,20,20)', justifyContent: 'space-around'},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12},
  logo: {width: 192, height: 160, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)'},
  headerText: {flex: 1},
  channel: {color: '#fff', fontSize: 40, fontWeight: '700'},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 6},
  meta: {color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '700'},
  metaDim: {color: 'rgba(255,255,255,0.75)', fontSize: 24, fontWeight: '700'},
  rating: {color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700'},
  image: {width: 180, height: 110, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)'},
  body: {flex: 1, paddingHorizontal: 18, paddingBottom: 18, gap: 8},
  title: {color: '#fff', fontSize: 40, fontWeight: '700'},
  badge: {alignSelf: 'flex-start', color: '#fff', fontSize: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)'},
  scroll: {flex: 1},
  description: {color: 'rgba(255,255,255,0.85)', fontSize: 20.8, lineHeight: 31.2},
  footer: {flexDirection: 'row', gap: 12, paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18},
  btn: {paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12},
  btnSecondary: {backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)'},
  btnText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  btnTextPrimary: {color: '#000'},
  notAvailable: {color: 'rgba(255,255,255,0.7)', fontSize: 15.2},
});
