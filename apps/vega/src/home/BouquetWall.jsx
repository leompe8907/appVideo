import * as React from 'react';
import {FlatList, TVFocusGuideView, Text, View} from 'react-native';
import {
  resolveBouquetLayoutForDevice,
  resolveHorizontalGridMode,
  resolveVerticalGridColumns,
} from '@appvideo/core/utils/bouquetLayoutConfig';
import {ChannelCard} from './ChannelCard';
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
  
  const card = (channel, index, fillWidth = false) => (
    <ChannelCard
      fillWidth={fillWidth}
      key={channelKey(channel, index)}
      channel={channel}
      cardDesign={layout.cardDesign}
      logoIndex={layout.logoIndex}
      backgroundColor={layout.backgroundColor}
      hasTVPreferredFocus={preferredChannelId != null && preferredChannelId === channelKey(channel, index)}
      onPress={() => onPlay(bouquet, index)}
    />
  );

  let body;
  if (layout.containerType === 'vertical_grid') {
    const columns = resolveVerticalGridColumns(layout.gridColumns);
    // Como la web (`repeat(N, minmax(0, 1fr))`): N columnas iguales que
    // ocupan todo el ancho, con la tarjeta estirada a su columna.
    body = (
      <View style={[styles.wrap, styles.gridFill]}>
        {items.map((c, i) => (
          <View key={channelKey(c, i)} style={[styles.gridFillCell, {width: `${100 / columns}%`}]}>
            {card(c, i, true)}
          </View>
        ))}
      </View>
    );
  } else {
    const mode = resolveHorizontalGridMode(layout.containerType, layout.cardDesign, layout.gridRows, layout.platformLayoutType, TV);
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
      body = (
        <FlatList
          horizontal
          data={toColumns(items, rows)}
          keyExtractor={(col) => channelKey(col[0][0], col[0][1])}
          renderItem={({item: col}) => <View>{col.map(([c, i]) => card(c, i))}</View>}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.track}
          showsHorizontalScrollIndicator={false}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={3}
        />
      );
    }
  }

  return (
    <View style={styles.bouquet}>
      <Text style={styles.heading}>{bouquet.name || bouquet.title || ''}</Text>
      {/* Como la web: ▶ en la última tarjeta no salta a otra fila. */}
      <TVFocusGuideView trapFocusRight>{body}</TVFocusGuideView>
    </View>
  );
});

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
  const preferredIndex = bouquets.findIndex((b) => keyOf(b) === preferredFocus?.bouquetKey);
  return (
    <FlatList
      style={styles.scroll}
      contentContainerStyle={styles.wall}
      data={bouquets}
      keyExtractor={keyOf}
      renderItem={({item}) => (
        <BouquetRow
          bouquet={item}
          onPlay={onPlay}
          preferredChannelId={preferredFocus?.bouquetKey === keyOf(item) ? preferredFocus.channelId : null}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      initialNumToRender={Math.max(3, preferredIndex + 2)}
      maxToRenderPerBatch={2}
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
