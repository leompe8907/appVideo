import * as React from 'react';
import {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Image, Pressable, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getBouquetsWithChannels, sortBouquetsByPriority} from '@appvideo/core/services/tvDataService';
import * as userSession from '@appvideo/core/utils/userSession';
import {FocusButton} from '../components/FocusButton';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';
import {getHomeMemory, rememberBouquet, rememberChannel, resetHomeMemory} from '../homeMemory';

const t = (key) => i18n.t(key);

function BouquetItem({bouquet, selected, onSelect, theme, hasTVPreferredFocus}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onFocus={() => {
        setFocused(true);
        onSelect();
      }}
      onBlur={() => setFocused(false)}
      onPress={onSelect}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[
        styles.bouquet,
        selected && {backgroundColor: theme.secondary},
        focused && {borderColor: theme.focusBorder},
      ]}>
      <Text style={[styles.bouquetText, {color: theme.text}]} numberOfLines={1}>
        {bouquet.name || bouquet.title || bouquet.bouquetId}
      </Text>
    </Pressable>
  );
}

function ChannelCard({channel, onPress, theme, hasTVPreferredFocus}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.card,
        {backgroundColor: focused ? theme.surfaceFocused : theme.surface},
        focused && {borderColor: theme.focusBorder, transform: [{scale: 1.06}]},
      ]}>
      <View style={styles.logoBox}>
        {channel.img ? (
          <Image source={{uri: channel.img}} style={styles.channelLogo} resizeMode="contain" />
        ) : (
          <Text style={[styles.lcn, {color: theme.textMuted}]}>{channel.lcn}</Text>
        )}
      </View>
      <Text style={[styles.channelName, {color: theme.text}]} numberOfLines={1}>
        {channel.lcn != null ? `${channel.lcn}  ` : ''}
        {channel.name}
      </Text>
    </Pressable>
  );
}

export function HomeScreen({navigate}) {
  const theme = getTheme();
  const [bouquets, setBouquets] = useState(null);
  const [initialMemory] = useState(getHomeMemory);
  const [selected, setSelectedState] = useState(initialMemory.bouquetIndex);
  const setSelected = (i) => {
    rememberBouquet(i);
    setSelectedState(i);
  };
  // Al volver del reproductor el foco va al canal que se estaba viendo.
  const returnChannel = initialMemory.channelIndex;
  const [error, setError] = useState('');

  const load = React.useCallback(async () => {
    setError('');
    setBouquets(null);
    try {
      const list = sortBouquetsByPriority(await getBouquetsWithChannels({enableRetry: true}));
      devLog('home:', list.length, 'bouquets');
      setSelectedState((i) => {
        const next = i < list.length ? i : 0;
        rememberBouquet(next);
        return next;
      });
      setBouquets(list);
    } catch (e) {
      devLog('home: error', e?.message);
      setError(e?.errorInfo?.userMessage || e?.message || t('errors.unexpected'));
      setBouquets([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logout = () => {
    userSession.setLoggedOut();
    resetHomeMemory();
    navigate('login');
  };

  if (bouquets === null) {
    return (
      <View style={[styles.center, {backgroundColor: theme.background}]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  const current = bouquets[selected];
  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <View style={[styles.sidebar, {backgroundColor: theme.primary}]}>
        {theme.logo ? <Image source={theme.logo} style={styles.logo} resizeMode="contain" /> : null}
        {bouquets.map((b, i) => (
          <BouquetItem
            key={b.bouquetId}
            bouquet={b}
            selected={i === selected}
            onSelect={() => setSelected(i)}
            theme={theme}
            hasTVPreferredFocus={returnChannel == null && i === selected}
          />
        ))}
        <View style={styles.spacer} />
        <FocusButton label={t('common.logout')} onPress={logout} />
      </View>
      <View style={styles.content}>
        {error ? (
          <View style={styles.center}>
            <Text style={[styles.error, {color: theme.error}]}>{error}</Text>
            <FocusButton label={t('player.retry')} onPress={load} hasTVPreferredFocus />
          </View>
        ) : (
          <>
            <Text style={[styles.heading, {color: theme.text}]}>{current?.name || ''}</Text>
            <FlatList
              data={current?.items || []}
              keyExtractor={(c) => String(c.id ?? c.epgStreamId ?? c.name)}
              numColumns={4}
              renderItem={({item, index}) => (
                <ChannelCard
                  channel={item}
                  theme={theme}
                  hasTVPreferredFocus={returnChannel === index}
                  onPress={() => {
                    rememberChannel(index);
                    navigate('player', {channels: current.items, index});
                  }}
                />
              )}
              contentContainerStyle={styles.grid}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  container: {flex: 1, flexDirection: 'row'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  sidebar: {width: 340, paddingVertical: 40, paddingHorizontal: 24},
  logo: {width: 260, height: 60, marginBottom: 32, alignSelf: 'center'},
  bouquet: {paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, borderWidth: 3, borderColor: 'transparent', marginBottom: 8},
  bouquetText: {fontSize: 24, fontWeight: '600'},
  spacer: {flex: 1},
  content: {flex: 1, paddingTop: 40, paddingHorizontal: 32},
  heading: {fontSize: 34, fontWeight: '700', marginBottom: 24, marginLeft: 12},
  grid: {paddingBottom: 60},
  card: {width: 300, height: 220, margin: 12, borderRadius: 16, borderWidth: 3, borderColor: 'transparent', padding: 16},
  logoBox: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  channelLogo: {width: 200, height: 120},
  lcn: {fontSize: 56, fontWeight: '700'},
  channelName: {fontSize: 22, marginTop: 8},
  error: {fontSize: 26, marginBottom: 24, textAlign: 'center'},
});
