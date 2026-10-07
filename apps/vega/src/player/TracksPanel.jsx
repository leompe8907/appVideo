import * as React from 'react';
import {useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {FocusRing} from '../components/FocusRing';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

// Mismos textos por defecto que el PlayerHud de la web (estas claves no están en los locales).
const DEFAULTS = {
  'player.tracks': 'Audio/Subtítulos',
  'player.audio': 'Audio',
  'player.subtitles': 'Subtítulos',
  'player.subtitlesOff': 'Desactivados',
  'player.noAudioTracks': 'Sin pistas de audio',
  'player.noSubtitleTracks': 'Sin subtítulos',
};
const t = (key) => i18n.t(key, {defaultValue: DEFAULTS[key]});

/** Hay algo que elegir: más de un audio o algún subtítulo (hasTrackOptions de la web). */
export const hasTrackOptions = (tracks) => (tracks?.audio || []).length > 1 || (tracks?.text || []).length > 0;

function TrackButton({label, meta, active, onPress, hasTVPreferredFocus}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.btnWrap}>
      <Pressable
        onPress={onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.btn, active && {backgroundColor: theme.primary}]}>
        <Text style={styles.btnLabel} numberOfLines={1}>
          {label}
        </Text>
        {meta ? <Text style={styles.btnMeta}>{meta}</Text> : null}
      </Pressable>
      <FocusRing visible={focused} radius={10} />
    </View>
  );
}

/**
 * Audio/Subtítulos (panel de pistas del PlayerHud de la web): columna de
 * audio y columna de subtítulos con "Desactivados". Atrás lo cierra el dueño.
 */
export function TracksPanel({tracks, onSelectAudio, onSelectText}) {
  const audio = tracks?.audio || [];
  const text = tracks?.text || [];
  const preferAudio = audio.find((a) => a.id === tracks?.selectedAudioId) || audio[0];
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>{t('player.tracks')}</Text>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>{t('player.audio')}</Text>
            <ScrollView>
              {audio.length === 0 ? <Text style={styles.empty}>{t('player.noAudioTracks')}</Text> : null}
              {audio.map((a) => (
                <TrackButton
                  key={a.id}
                  label={a.label || a.lang || 'Audio'}
                  meta={a.lang && a.lang !== a.label ? a.lang : ''}
                  active={a.id === tracks?.selectedAudioId}
                  hasTVPreferredFocus={a === preferAudio}
                  onPress={() => onSelectAudio(a.id)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>{t('player.subtitles')}</Text>
            <ScrollView>
              <TrackButton
                label={t('player.subtitlesOff')}
                active={!tracks?.textEnabled}
                hasTVPreferredFocus={audio.length === 0}
                onPress={() => onSelectText(null)}
              />
              {text.length === 0 ? <Text style={styles.empty}>{t('player.noSubtitleTracks')}</Text> : null}
              {text.map((s) => (
                <TrackButton
                  key={s.id}
                  label={s.label || s.lang || 'Sub'}
                  meta={s.lang && s.lang !== s.label ? s.lang : ''}
                  active={tracks?.textEnabled && s.id === tracks?.selectedTextId}
                  onPress={() => onSelectText(s.id)}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

// _player-hud.scss (tracks) a 1920×1080.
const styles = createScaledStyles({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)'},
  box: {width: 960, maxHeight: 760, padding: 28, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(10,10,12,0.95)'},
  title: {color: '#fff', fontSize: 34, fontWeight: '700', marginBottom: 20},
  columns: {flexDirection: 'row', gap: 32},
  column: {flex: 1},
  columnTitle: {color: 'rgba(255,255,255,0.75)', fontSize: 26, fontWeight: '600', marginBottom: 12},
  empty: {color: 'rgba(255,255,255,0.6)', fontSize: 22, paddingVertical: 8},
  btnWrap: {marginBottom: 10},
  btn: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)'},
  btnLabel: {flex: 1, color: '#fff', fontSize: 24, fontWeight: '600'},
  btnMeta: {color: 'rgba(255,255,255,0.7)', fontSize: 20, marginLeft: 12},
});
