import * as React from 'react';
import {FlatList, ScrollView, Text, View} from 'react-native';
import {
  resolveBouquetLayoutForDevice,
  resolveHorizontalGridMode,
  resolveVerticalGridColumns,
} from '@appvideo/core/utils/bouquetLayoutConfig';
import {ChannelCard, cellWidthFor} from './ChannelCard';
import {createScaledStyles, px} from '../scaledStyles';

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

function BouquetRow({bouquet, onPlay, preferredFocus}) {
  const layout = resolveBouquetLayoutForDevice(bouquet, TV);
  const items = bouquet.items || [];
  const width = cellWidthFor(layout.cardDesign);
  const bKey = keyOf(bouquet);

  const card = (channel, index) => (
    <ChannelCard
      key={channelKey(channel, index)}
      channel={channel}
      cardDesign={layout.cardDesign}
      logoIndex={layout.logoIndex}
      backgroundColor={layout.backgroundColor}
      hasTVPreferredFocus={preferredFocus?.bouquetKey === bKey && preferredFocus?.channelId === channelKey(channel, index)}
      onPress={() => onPlay(bouquet, index)}
    />
  );

  let body;
  if (layout.containerType === 'vertical_grid') {
    const columns = resolveVerticalGridColumns(layout.gridColumns);
    body = (
      <View style={[styles.wrap, {width: px(columns * (width + CARD_GAP))}]}>
        {items.map((c, i) => (
          <View key={channelKey(c, i)} style={styles.gridCell}>
            {card(c, i)}
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
          initialNumToRender={28}
          windowSize={5}
        />
      );
    }
  }

  return (
    <View style={styles.bouquet}>
      <Text style={styles.heading}>{bouquet.name || bouquet.title || ''}</Text>
      {body}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/**
 * Muro de bouquets (BouquetWall de la web, spec §2.3): un único scroll
 * vertical; cada bouquet con su layout de TV (`bouquetLayouts.tv` /
 * customData / layoutType).
 */
export function BouquetWall({bouquets, onPlay, preferredFocus}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.wall} showsVerticalScrollIndicator={false}>
      {bouquets.map((b) => (
        <BouquetRow key={keyOf(b)} bouquet={b} onPlay={onPlay} preferredFocus={preferredFocus} />
      ))}
    </ScrollView>
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
});
