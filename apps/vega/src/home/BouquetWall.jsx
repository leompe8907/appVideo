import * as React from 'react';
import {FlatList, TVFocusGuideView, Text, View} from 'react-native';
import {
  resolveBouquetLayoutForDevice,
  resolveHorizontalGridMode,
  resolveVerticalGridColumns,
} from '@appvideo/core/utils/bouquetLayoutConfig';
import {ChannelCard} from './ChannelCard';
import {setFocusedChannel} from './focusedChannel';
import {createScaledStyles} from '../scaledStyles';

const TV = {isTV: true, isPC: false};
const CARD_GAP = 32;

const keyOf = (bouquet) => String(bouquet.bouquetId ?? bouquet.id);
const channelKey = (c, i) => String(c?.id ?? c?.epgStreamId ?? i);

/** Agrupa los canales en columnas de `rows` tarjetas (flujo por columnas, multi-fila). */
function toColumns(items, rows) {
  const columns = [];
  for (let i = 0; i < items.length; i += rows) columns.push(items.slice(i, i + rows).map((c, k) => [c, i + k]));
  return columns;
}

// Memo: sólo se re-renderiza la fila cuyo canal recordado cambia.
const BouquetRow = React.memo(function BouquetRow({bouquet, onPlay, preferredChannelId}) {
  const layout = resolveBouquetLayoutForDevice(bouquet, TV);
  const items = bouquet.items || [];
  
  const card = (channel, index) => (
    <ChannelCard
      key={channelKey(channel, index)}
      channel={channel}
      cardDesign={layout.cardDesign}
      logoIndex={layout.logoIndex}
      backgroundColor={layout.backgroundColor}
      hasTVPreferredFocus={preferredChannelId != null && preferredChannelId === channelKey(channel, index)}
      onPress={() => onPlay(bouquet, index)}
      onFocus={() => setFocusedChannel(channel)}
    />
  );

  const mode = resolveHorizontalGridMode(layout.containerType, layout.cardDesign, layout.gridRows, layout.platformLayoutType, TV);
  let body;
  if (!mode.scrollX) {
    // logo+LCN en TV: grilla que envuelve, sin scroll horizontal.
    body = (
      <View style={[styles.track, styles.wrap]}>
        {items.map((c, i) => (
          <View key={channelKey(c, i)} style={styles.gridCell}>
            {card(c, i)}
          </View>
        ))}
      </View>
    );
  } else {
    const rows = Math.max(1, mode.rows || 1);
    // Al volver del reproductor la columna del canal recordado tiene que estar
    // armada para recibir el foco (antes sólo se armaban 6: un canal más
    // adelante en la fila perdía el foco y caía en la primera tarjeta).
    const preferredIndex = preferredChannelId == null ? -1 : items.findIndex((c, i) => channelKey(c, i) === preferredChannelId);
    const preferredColumn = preferredIndex < 0 ? 0 : Math.floor(preferredIndex / rows);
    body = (
      <FlatList
        horizontal
        data={toColumns(items, rows)}
        keyExtractor={(col) => channelKey(col[0][0], col[0][1])}
        renderItem={({item: col}) => <View>{col.map(([c, i]) => card(c, i))}</View>}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.track}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={Math.max(6, preferredColumn + 3)}
        maxToRenderPerBatch={4}
        windowSize={3}
      />
    );
  }

  return (
    <View style={styles.bouquet}>
      <Text style={styles.heading}>{bouquet.name || bouquet.title || ''}</Text>
      {/* Como la web: ▶ en la última tarjeta no salta a otra fila. */}
      <TVFocusGuideView trapFocusRight>{body}</TVFocusGuideView>
    </View>
  );
});

/**
 * Grilla vertical (`vertical_grid`): como la web (`repeat(N, minmax(0, 1fr))`),
 * N columnas iguales que ocupan todo el ancho. Cada fila es un ítem de la lista
 * del muro, así sólo se arman las filas cercanas a la pantalla (Canales de
 * Wind: un bouquet con más de 100 canales tardaba ~1,8 s en dibujarse).
 */
const GridRow = React.memo(function GridRow({bouquet, start, columns, onPlay, preferredChannelId}) {
  const layout = resolveBouquetLayoutForDevice(bouquet, TV);
  const cells = (bouquet.items || []).slice(start, start + columns);
  return (
    // Como la web: ▶ en la última tarjeta no salta a la fila siguiente.
    <TVFocusGuideView trapFocusRight style={[styles.wrap, styles.gridFill]}>
      {cells.map((channel, k) => {
        const index = start + k;
        return (
          <View key={channelKey(channel, index)} style={[styles.gridFillCell, {width: `${100 / columns}%`}]}>
            <ChannelCard
              fillWidth
              channel={channel}
              cardDesign={layout.cardDesign}
              logoIndex={layout.logoIndex}
              backgroundColor={layout.backgroundColor}
              hasTVPreferredFocus={preferredChannelId != null && preferredChannelId === channelKey(channel, index)}
              onPress={() => onPlay(bouquet, index)}
              onFocus={() => setFocusedChannel(channel)}
            />
          </View>
        );
      })}
    </TVFocusGuideView>
  );
});

/** Ítems de la lista del muro: un bouquet entero, o título + filas si es grilla vertical. */
function toWallItems(bouquets) {
  const items = [];
  for (const bouquet of bouquets) {
    const key = keyOf(bouquet);
    const layout = resolveBouquetLayoutForDevice(bouquet, TV);
    if (layout.containerType !== 'vertical_grid') {
      items.push({type: 'bouquet', key, bouquet});
      continue;
    }
    const columns = resolveVerticalGridColumns(layout.gridColumns);
    const channels = bouquet.items || [];
    items.push({type: 'heading', key: `${key}:h`, bouquet});
    for (let start = 0; start < channels.length; start += columns) {
      items.push({type: 'row', key: `${key}:${start}`, bouquet, start, columns, last: start + columns >= channels.length});
    }
  }
  return items;
}

function Separator() {
  return <View style={styles.separator} />;
}

/**
 * Muro de bouquets (BouquetWall de la web, spec §2.3): un único scroll
 * vertical; cada bouquet con su layout de TV (`bouquetLayouts.tv` /
 * customData / layoutType).
 */
export function BouquetWall({bouquets, onPlay, preferredFocus, header, footer}) {
  // Lista vertical virtualizada: sólo se arman los bouquets cerca de la
  // pantalla (con 10+ bouquets el ScrollView armaba cientos de tarjetas y
  // cada movimiento de foco se sentía lento). Se arma al menos hasta el
  // bouquet del canal recordado, para que reciba el foco al volver.
  const items = React.useMemo(() => toWallItems(bouquets), [bouquets]);
  const preferredChannelOf = (bouquet) => (preferredFocus?.bouquetKey === keyOf(bouquet) ? preferredFocus.channelId : null);
  // Ítem que tiene el canal recordado (en una grilla, su fila).
  const preferredIndex = items.findIndex((it) => {
    const id = preferredChannelOf(it.bouquet);
    if (id == null || it.type === 'heading') return false;
    if (it.type === 'bouquet') return true;
    return (it.bouquet.items || []).slice(it.start, it.start + it.columns).some((c, k) => channelKey(c, it.start + k) === id);
  });
  return (
    <FlatList
      style={styles.scroll}
      contentContainerStyle={styles.wall}
      data={items}
      keyExtractor={(it) => it.key}
      renderItem={({item: it}) => {
        if (it.type === 'heading') return <Text style={styles.heading}>{it.bouquet.name || it.bouquet.title || ''}</Text>;
        if (it.type === 'row') {
          return (
            <View style={it.last ? styles.bouquet : null}>
              <GridRow bouquet={it.bouquet} start={it.start} columns={it.columns} onPlay={onPlay} preferredChannelId={preferredChannelOf(it.bouquet)} />
            </View>
          );
        }
        return <BouquetRow bouquet={it.bouquet} onPlay={onPlay} preferredChannelId={preferredChannelOf(it.bouquet)} />;
      }}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      initialNumToRender={Math.max(4, preferredIndex + 2)}
      maxToRenderPerBatch={3}
      windowSize={3}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = createScaledStyles({
  scroll: {flex: 1},
  wall: {marginHorizontal: 32, paddingTop: 16, paddingBottom: 52},
  bouquet: {marginBottom: CARD_GAP},
  heading: {color: '#fff', fontSize: 25.6, fontWeight: '600', marginBottom: 5.6, paddingHorizontal: 4},
  track: {paddingLeft: 20, paddingRight: 28, paddingTop: 8},
  separator: {width: CARD_GAP},
  wrap: {flexDirection: 'row', flexWrap: 'wrap'},
  gridCell: {marginRight: CARD_GAP},
  gridFill: {marginHorizontal: -CARD_GAP / 2},
  gridFillCell: {paddingHorizontal: CARD_GAP / 2},
});
