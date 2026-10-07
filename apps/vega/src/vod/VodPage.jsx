import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, TVFocusGuideView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {VodCard, VodSeeMoreCard} from './VodCard';
import {VodDetail} from './VodDetail';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);
const ITEMS_PER_ROW = 9;

function Gap() {
  return <View style={styles.gap} />;
}

/** Grilla de un género completo ("Ver más", VodCategoryModal): 6 columnas. */
function CategoryGrid({category, onSelect, onClose}) {
  const [closeFocused, setCloseFocused] = useState(false);
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalPanel}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{category.name}</Text>
          <Pressable
            onPress={onClose}
            onFocus={() => setCloseFocused(true)}
            onBlur={() => setCloseFocused(false)}
            style={[styles.closeBtn, closeFocused && styles.closeBtnFocused]}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <FlatList
          data={category.vods || []}
          numColumns={6}
          keyExtractor={(v, i) => String(v?.id ?? i)}
          renderItem={({item, index}) => (
            <View style={styles.gridCell}>
              <VodCard item={item} hasTVPreferredFocus={index === 0} onPress={() => onSelect(item)} />
            </View>
          )}
          contentContainerStyle={styles.grid}
        />
      </View>
    </View>
  );
}

/**
 * Página Películas (VodPage de la web, spec 2 §1): título y una fila por
 * género (máx. 9 + "Ver más"), detalle a pantalla completa al elegir.
 */
export function VodPage({onPlay, onModalChange, active = true}) {
  const brand = getActiveBrandConfig();
  const vod = usePreloadStore((s) => s.vod);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const [detail, setDetail] = useState(null);
  const [grid, setGrid] = useState(null);
  const retried = useRef(false);

  useEffect(() => {
    if (vod.status === 'idle') loadVOD(brand, {t});
    else if (vod.status === 'error' && !retried.current) {
      retried.current = true;
      loadVOD(brand, {t, force: true, enableRetry: true});
    }
  }, [vod.status, brand, loadVOD]);

  useEffect(() => {
    onModalChange?.(Boolean(detail || grid));
  }, [detail, grid, onModalChange]);

  // Atrás cierra el modal de arriba (detalle, después la grilla). Sólo con el
  // home en primer plano: debajo del reproductor, Atrás es del reproductor.
  useEffect(() => {
    if (!active || (!detail && !grid)) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detail) setDetail(null);
      else setGrid(null);
      return true;
    });
    return () => sub.remove();
  }, [detail, grid, active]);

  const categories = vod.categories || [];

  let body;
  if (vod.status === 'loading' || vod.status === 'idle') {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.info}>{t('vod.loading')}</Text>
      </View>
    );
  } else if (vod.status === 'error' && categories.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.error}>{vod.error || t('vod.errorLoad')}</Text>
      </View>
    );
  } else if (categories.length === 0) {
    body = <Text style={styles.empty}>{t('vod.noContent')}</Text>;
  } else {
    body = (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {categories.map((cat, row) => {
          const vods = cat.vods || [];
          const shown = vods.slice(0, ITEMS_PER_ROW);
          const data = vods.length > ITEMS_PER_ROW ? [...shown, {__more: true}] : shown;
          return (
            <View key={String(cat.id)} style={styles.row}>
              <Text style={styles.rowTitle}>{cat.name}</Text>
              <TVFocusGuideView trapFocusRight>
                <FlatList
                  horizontal
                  data={data}
                  keyExtractor={(v, i) => (v.__more ? 'more' : String(v?.id ?? i))}
                  ItemSeparatorComponent={Gap}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                  renderItem={({item, index}) =>
                    item.__more ? (
                      <VodSeeMoreCard label={t('vod.seeMore')} onPress={() => setGrid(cat)} />
                    ) : (
                      <VodCard item={item} hasTVPreferredFocus={!detail && !grid && row === 0 && index === 0} onPress={() => setDetail(item)} />
                    )
                  }
                />
              </TVFocusGuideView>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{t('vod.title')}</Text>
      {body}
      {grid ? <CategoryGrid category={grid} onSelect={setDetail} onClose={() => setGrid(null)} /> : null}
      {detail ? <VodDetail item={detail} categories={categories} onPlay={onPlay} /> : null}
    </View>
  );
}

// _vod.scss a 1920×1080 (spec 2 §1.2-1.6).
const styles = createScaledStyles({
  page: {flex: 1, padding: 16},
  title: {color: '#fff', fontSize: 29.6, fontWeight: '600', marginBottom: 8},
  content: {flex: 1},
  contentInner: {paddingBottom: 45.6},
  row: {marginBottom: 28},
  rowTitle: {color: 'rgba(255,255,255,0.95)', fontSize: 23.2, fontWeight: '600', marginBottom: 8},
  rail: {paddingVertical: 20, paddingLeft: 24, paddingRight: 28},
  gap: {width: 24},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  info: {color: '#fff', fontSize: 20, marginTop: 16},
  error: {color: '#ffb3b3', fontSize: 20},
  empty: {color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 32},
  modalOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, padding: 16, backgroundColor: 'rgba(0,0,0,0.8)'},
  modalPanel: {flex: 1, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(28,28,28,0.98)'},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {color: '#fff', fontSize: 28, fontWeight: '600'},
  closeBtn: {minHeight: 48, paddingHorizontal: 24, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.15)'},
  closeBtnFocused: {borderColor: '#3355FF', borderWidth: 3},
  closeText: {color: '#fff', fontSize: 18.4, fontWeight: '600'},
  grid: {paddingTop: 24, paddingHorizontal: 48, paddingBottom: 32},
  gridCell: {marginRight: 52, marginBottom: 20},
});
