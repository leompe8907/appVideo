import * as React from 'react';
import {useState} from 'react';
import {Image, Pressable, Text, View} from 'react-native';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {getVodImageUrl} from '@appvideo/core/services/vodService';
import {RemoteImage} from '../components/RemoteImage';
import {FocusRing} from '../components/FocusRing';
import {createScaledStyles} from '../scaledStyles';

export function vodPosterUrl(item) {
  return item?.posterListURL || item?.posterInfoURL || getVodImageUrl(getActiveBrandConfig()?.drm, item?.image1Id, 'posterList') || null;
}

/** Tarjeta de VOD (VodCard de la web, spec 2 §1.4): póster 224×336 + título. */
export function VodCard({item, onPress, hasTVPreferredFocus, onFocus}) {
  const [focused, setFocused] = useState(false);
  const uri = vodPosterUrl(item);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}>
        <View style={styles.poster}><RemoteImage uri={uri} style={styles.image} resizeMode="cover" /></View>
        <Text style={styles.title} numberOfLines={1}>
          {item?.name || item?.title || ''}
        </Text>
      </Pressable>
      <FocusRing visible={focused} radius={8} />
    </View>
  );
}

/** Tarjeta "Ver más" (VodSeeMoreCard): mismo tamaño, "+" centrado. */
export function VodSeeMoreCard({label, onPress}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <View style={[styles.poster, styles.center]}>
          <Text style={styles.plus}>+</Text>
        </View>
        <Text style={styles.title}>{label}</Text>
      </Pressable>
      <FocusRing visible={focused} radius={8} />
    </View>
  );
}

// _vod.scss a 1920×1080 (spec 2 §1.4-1.5).
const styles = createScaledStyles({
  card: {width: 224},
  poster: {
    width: 224,
    height: 336,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(40,40,40,0.8)',
    overflow: 'hidden',
  },
  image: {width: '100%', height: '100%'},
  center: {alignItems: 'center', justifyContent: 'center'},
  plus: {color: 'rgba(255,255,255,0.9)', fontSize: 56, fontWeight: '700'},
  title: {marginTop: 8, color: '#fff', fontSize: 18.4, lineHeight: 24},
});
