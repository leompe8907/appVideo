import * as React from 'react';
import {useEffect, useRef} from 'react';
import {FlatList, TVFocusGuideView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {VodCard, VodSeeMoreCard} from '../vod/VodCard';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const ITEMS_PER_ROW = 9;

function Gap() {
  return <View style={styles.gap} />;
}

/**
 * Carril "Recomendado" de VOD debajo de los bouquets de Inicio
 * (VodRecommendedHomeRail de la web): si hay más de 9, la primera tarjeta es
 * "Ver todas las películas" (va a Películas). OK en una película abre su
 * detalle (lo maneja el home); al cerrarlo el foco vuelve a esa tarjeta (`focusId`).
 */
export function VodRecommendedRail({onSelect, onSeeAll, focusId}) {
  const brand = getActiveBrandConfig();
  const vod = usePreloadStore((s) => s.vod);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const retried = useRef(false);

  useEffect(() => {
    if (vod.status === 'idle') loadVOD(brand, {t});
    else if (vod.status === 'error' && !retried.current) {
      retried.current = true;
      loadVOD(brand, {t, force: true, enableRetry: true});
    }
  }, [vod.status, brand, loadVOD]);

  const items = vod.vodRecommended || [];
  if (vod.status !== 'ready' || items.length === 0) return null;
  const data = items.length > ITEMS_PER_ROW ? [{__more: true}, ...items] : items;

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{t('vod.recommended')}</Text>
      <TVFocusGuideView trapFocusRight>
        <FlatList
          horizontal
          data={data}
          keyExtractor={(v, i) => (v.__more ? 'more' : String(v?.id ?? i))}
          ItemSeparatorComponent={Gap}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          initialNumToRender={6}
          windowSize={3}
          renderItem={({item}) =>
            item.__more ? (
              <VodSeeMoreCard label={t('vod.seeAllMovies')} onPress={onSeeAll} />
            ) : (
              <VodCard item={item} hasTVPreferredFocus={focusId != null && String(item?.id) === String(focusId)} onPress={() => onSelect(item)} />
            )
          }
        />
      </TVFocusGuideView>
    </View>
  );
}

// _vod.scss (vod-row) como en Películas.
const styles = createScaledStyles({
  row: {marginTop: 8, marginBottom: 28},
  title: {color: '#fff', fontSize: 25.6, fontWeight: '600', marginBottom: 5.6, paddingHorizontal: 4},
  rail: {paddingVertical: 20, paddingLeft: 20, paddingRight: 28},
  gap: {width: 24},
});
