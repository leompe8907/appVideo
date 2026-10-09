import * as React from 'react';
import {useEffect, useState} from 'react';
import {Image, Pressable, TVFocusGuideView, View, useTVEventHandler} from 'react-native';
import {getDisplayTimeMs, isVideoUrl} from '@appvideo/core/utils/adsData';
import {FocusRing} from '../components/FocusRing';
import {createScaledStyles, px} from '../scaledStyles';

/**
 * Zona de banners (AdZone de la web, spec §2.8): imagen a todo el ancho,
 * rotación cada `displayTime` (pausada con foco), puntos, ◄/► cambian de
 * banner con foco y OK lo activa. Los videos se omiten por ahora (se muestran
 * sólo banners de imagen).
 * TODO: banners de video; probar con una marca que tenga publicidad
 * (la cuenta de prueba de INTV no devuelve ninguno).
 */
export function AdZone({ads, position, onActivate}) {
  const list = (ads || []).filter((a) => a?.file && !isVideoUrl(a.file));
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [ratio, setRatio] = useState(null);
  const ad = list[index % Math.max(1, list.length)];

  useEffect(() => {
    if (list.length < 2 || focused) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % list.length), getDisplayTimeMs(ad));
    return () => clearTimeout(timer);
  }, [index, list.length, focused, ad]);

  useEffect(() => {
    if (!ad?.file) return;
    Image.getSize(ad.file, (w, h) => h > 0 && setRatio(w / h), () => setRatio(null));
  }, [ad?.file]);

  useTVEventHandler((evt) => {
    if (!focused || !evt || evt.eventKeyAction === 1 || list.length < 2) return;
    if (evt.eventType === 'left') setIndex((i) => (i - 1 + list.length) % list.length);
    if (evt.eventType === 'right') setIndex((i) => (i + 1) % list.length);
  });

  if (!ad) return null;
  const maxHeight = position === 'bottom' ? 104 : 128;
  // Como AdZone de la web: con más de un banner, ◄/► cambian de banner y la
  // tecla no mueve el foco (sin esto el Fire TV lo llevaba a una tarjeta del
  // bouquet de abajo). Con uno solo, ◄/► navegan normal.
  const multiple = list.length > 1;
  return (
    <View style={[styles.zone, position === 'bottom' ? styles.bottom : styles.top]}>
      <TVFocusGuideView trapFocusLeft={multiple} trapFocusRight={multiple}>
        <Pressable onPress={() => onActivate?.(ad)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
          <Image resizeMethod="resize"
            source={{uri: ad.file}}
            resizeMode="contain"
            style={{width: '100%', height: ratio ? undefined : px(maxHeight), aspectRatio: ratio || undefined, maxHeight: px(maxHeight * 2)}}
          />
        </Pressable>
        <FocusRing visible={focused} radius={0} />
      </TVFocusGuideView>
      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((a, i) => (
            <View key={String(a.id ?? i)} style={[styles.dot, i === index % list.length && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// _home-ads.scss (spec §2.8).
const styles = createScaledStyles({
  zone: {width: '100%', backgroundColor: 'rgba(0,0,0,0.35)'},
  top: {borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)'},
  bottom: {borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 6.4},
  dots: {flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6, paddingHorizontal: 8, paddingBottom: 4},
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)'},
  dotActive: {backgroundColor: 'rgba(255,255,255,0.95)'},
});
