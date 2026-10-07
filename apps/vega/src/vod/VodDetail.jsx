import * as React from 'react';
import {useEffect, useState} from 'react';
import {Image, Pressable, ScrollView, Text, View} from 'react-native';
import LinearGradient from '@amazon-devices/react-linear-gradient';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import panaccessService from '@appvideo/core/services/panaccessService';
import {getVodImageUrl} from '@appvideo/core/services/vodService';
import {FullScreenImage} from '../components/FullScreenImage';
import {FocusRing} from '../components/FocusRing';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key, opts) => i18n.t(key, opts);
const DESCRIPTION_MAX_LENGTH = 180;

const PLAY_ICON = require('../../assets/icons/app-play.png');

function genreNames(item, categories) {
  if (Array.isArray(item?.categoryNames) && item.categoryNames.length) return item.categoryNames;
  if (item?.categoryName) return [item.categoryName];
  const byId = new Map((categories || []).map((c) => [String(c.id), c.name]));
  return (item?.categories || []).map((id) => byId.get(String(id))).filter(Boolean);
}

function Stars({rating, color}) {
  const value = Math.max(0, Math.min(5, (Number(rating) || 0) / 10));
  if (value <= 0) return null;
  return (
    <View style={styles.stars}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = value >= i + 1 ? 1 : value > i ? 0.5 : 0;
        return (
          <Text key={i} style={[styles.star, {color: fill > 0 ? color : 'rgba(255,255,255,0.3)', opacity: fill === 0.5 ? 0.6 : 1}]}>
            ★
          </Text>
        );
      })}
    </View>
  );
}

function FocusText({label, onPress, style, textStyle, hasTVPreferredFocus, radius = 6, children}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.focusWrap}>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={style}>
        {children}
        {label ? <Text style={textStyle}>{label}</Text> : null}
      </Pressable>
      <FocusRing visible={focused} radius={radius} />
    </View>
  );
}

/**
 * Detalle de VOD layout "hero" (VodDetailModal de la web, spec 2 §2): fondo
 * con `backgroundImageURL` y degradado, póster, metadatos, descripción con
 * "Leer más", "Reproducir" (foco inicial) y episodios si es serie.
 */
export function VodDetail({item, categories, onPlay}) {
  const theme = getTheme();
  const drm = getActiveBrandConfig()?.drm;
  const [expanded, setExpanded] = useState(false);
  const [series, setSeries] = useState(null); // {description, episodes}
  const [loadingSeries, setLoadingSeries] = useState(item?.isSeries === true);

  useEffect(() => {
    if (item?.isSeries !== true) return undefined;
    let cancelled = false;
    panaccessService
      .getVodSeriesInfo({seriesId: item.id, enableRetry: false})
      .then((data) => {
        const episodes = data?.episodes ?? (data?.seasons || []).flatMap((s) => s?.episodes || []) ?? [];
        if (!cancelled) setSeries({description: data?.description, episodes});
      })
      .catch((e) => {
        devLog('vod: getVodSeriesInfo', e?.message);
        if (!cancelled) setSeries({episodes: []});
      })
      .finally(() => !cancelled && setLoadingSeries(false));
    return () => {
      cancelled = true;
    };
  }, [item]);

  const play = (vodItem) => {
    const vodId = vodItem?.id ?? vodItem?.vodId;
    if (vodId == null) return;
    onPlay({vodId, item: vodItem, title: vodItem?.name || vodItem?.title || item?.name});
  };

  const year = /^(\d{4})/.exec(String(item?.libraryReleaseDate || ''))?.[1];
  const minutes = Math.floor((Number(item?.duration) || 0) / 60);
  const rating = item?.parentalRating ? String(item.parentalRating).replace(/^\+?/, '+') : null;
  const genres = genreNames(item, categories);
  const description = item?.description || series?.description || '';
  const longDescription = description.length > DESCRIPTION_MAX_LENGTH;
  const shownDescription = !longDescription || expanded ? description : `${description.slice(0, DESCRIPTION_MAX_LENGTH)}…`;
  const directors = item?.directorNames || [];
  const cast = item?.actorNames || [];
  const poster = item?.posterInfoURL || item?.posterListURL || getVodImageUrl(drm, item?.image1Id, 'posterInfo');
  const episodes = series?.episodes || [];
  const playTarget = item?.isSeries ? episodes[0] : item;

  return (
    <View style={styles.overlay}>
      {item?.backgroundImageURL ? <FullScreenImage source={{uri: item.backgroundImageURL}} /> : null}
      <LinearGradient
        colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
        locations={[0, 0.3, 0.6]}
        start={{x: 0, y: 1}}
        end={{x: 0, y: 0}}
        style={styles.gradient}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <View style={styles.posterWrap}>{poster ? <Image resizeMethod="resize" source={{uri: poster}} style={styles.poster} resizeMode="stretch" /> : null}</View>
          <View style={styles.info}>
            <Text style={styles.title}>{item?.name || item?.title}</Text>
            <View style={styles.metaRow}>
              {year ? <Text style={styles.meta}>{year}</Text> : null}
              {minutes > 0 ? <Text style={styles.meta}>{`${minutes} ${t('vod.minutes')}`}</Text> : null}
              {rating ? <Text style={[styles.meta, styles.badge]}>{rating}</Text> : null}
              {genres.map((g) => (
                <Text key={g} style={[styles.meta, styles.chip]}>
                  {g}
                </Text>
              ))}
              <Stars rating={item?.rating} color={theme.secondary} />
            </View>
            {directors.length ? <Text style={[styles.meta, styles.chip, styles.people]}>{`${t('vod.directors')}: ${directors.join(', ')}`}</Text> : null}
            {cast.length ? <Text style={[styles.meta, styles.chip, styles.people]}>{`${t('vod.cast')}: ${cast.join(', ')}`}</Text> : null}
            {description ? <Text style={styles.description}>{shownDescription}</Text> : null}
            {longDescription ? (
              <FocusText
                label={expanded ? t('vod.readLess') : t('vod.readMore')}
                onPress={() => setExpanded((v) => !v)}
                style={styles.readMore}
                textStyle={styles.readMoreText}
                radius={4}
              />
            ) : null}
            {loadingSeries ? <Text style={styles.metaSmall}>{t('vod.loading')}</Text> : null}
            {!loadingSeries && playTarget ? (
              <FocusText
                label={t('vod.play')}
                onPress={() => play(playTarget)}
                hasTVPreferredFocus
                style={[styles.playBtn, {backgroundColor: theme.primary}]}
                textStyle={styles.playText}>
                <Image source={PLAY_ICON} style={styles.playIcon} />
              </FocusText>
            ) : null}
          </View>
        </View>
        {episodes.length > 0 ? (
          <View style={styles.episodes}>
            <Text style={styles.episodesTitle}>{t('vod.episodes')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodesRow}>
              {episodes.map((ep, i) => {
                const thumb = ep?.posterListURL || getVodImageUrl(drm, ep?.image1Id, 'posterList');
                const epMinutes = Math.floor((Number(ep?.duration) || 0) / 60);
                return (
                  <FocusText key={String(ep?.id ?? ep?.vodId ?? i)} onPress={() => play(ep)} style={styles.episode} radius={8}>
                    <View style={styles.episodeThumb}>
                      {thumb ? <Image resizeMethod="resize" source={{uri: thumb}} style={styles.poster} resizeMode="cover" /> : null}
                    </View>
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeName} numberOfLines={1}>
                        {ep?.name ?? ep?.title ?? ep?.episodeTitle ?? `Episode ${i + 1}`}
                      </Text>
                      {epMinutes > 0 ? <Text style={styles.episodeDuration}>{`${epMinutes} ${t('vod.minutes')}`}</Text> : null}
                    </View>
                  </FocusText>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// _vod.scss a 1920×1080 (spec 2 §2).
const styles = createScaledStyles({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: '#111'},
  gradient: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  scroll: {flex: 1},
  content: {flexGrow: 1, justifyContent: 'flex-end', paddingTop: 32, paddingHorizontal: 40, paddingBottom: 40},
  inner: {flexDirection: 'row'},
  posterWrap: {
    width: 288,
    height: 432,
    marginRight: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  poster: {width: '100%', height: '100%'},
  info: {flex: 1, justifyContent: 'flex-end'},
  title: {color: '#fff', fontSize: 40, fontWeight: '700', marginBottom: 8},
  metaRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 12},
  meta: {color: 'rgba(255,255,255,0.9)', fontSize: 23.2, paddingVertical: 3.5, paddingHorizontal: 9.3, marginRight: 20, marginBottom: 12},
  metaSmall: {color: 'rgba(255,255,255,0.8)', fontSize: 19.2, marginBottom: 12},
  badge: {borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 4, fontWeight: '600'},
  chip: {backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 4},
  people: {alignSelf: 'flex-start', marginBottom: 6},
  stars: {flexDirection: 'row', marginBottom: 12},
  star: {fontSize: 23.2, marginRight: 2.4},
  description: {color: 'rgba(255,255,255,0.9)', fontSize: 19.2, lineHeight: 28.8, maxWidth: '90%', marginBottom: 12},
  focusWrap: {alignSelf: 'flex-start'},
  readMore: {marginBottom: 12},
  readMoreText: {color: 'rgba(255,255,255,0.85)', fontSize: 17.6, textDecorationLine: 'underline'},
  playBtn: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10.4, paddingHorizontal: 24, borderRadius: 6, marginTop: 4},
  playIcon: {width: 22, height: 22, tintColor: '#fff', marginRight: 8},
  playText: {color: '#fff', fontSize: 20.8, fontWeight: '600'},
  episodes: {marginTop: 8},
  episodesTitle: {color: '#fff', fontSize: 22.4, fontWeight: '600', marginBottom: 12},
  episodesRow: {gap: 16, paddingBottom: 8},
  episode: {width: 160, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden'},
  episodeThumb: {width: 156, height: 88, backgroundColor: '#1a1a1a'},
  episodeInfo: {paddingVertical: 8, paddingHorizontal: 9.6},
  episodeName: {color: '#fff', fontSize: 16.8, fontWeight: '500'},
  episodeDuration: {color: 'rgba(255,255,255,0.65)', fontSize: 15.2},
});
