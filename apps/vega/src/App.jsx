import * as React from 'react';
import {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import '@appvideo/core/locales/i18n';
import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import panaccessService from '@appvideo/core/services/panaccessService';
import * as userSession from '@appvideo/core/utils/userSession';
import {getBouquetsWithChannels} from '@appvideo/core/services/tvDataService';
import {devLog} from './devLog';

export function App() {
  const [lines, setLines] = useState([]);
  const log = (...a) => {
    devLog(...a);
    setLines((prev) => [...prev, a.map(String).join(' ')]);
  };

  useEffect(() => {
    (async () => {
      try {
        const brand = getActiveBrandConfig();
        log('marca', brand?.brand, 'token', brand?.token ? 'sí' : 'NO', 'drm', brand?.drm ? 'sí' : 'NO');
        await panaccessService.initialize(brand);
        log('sesión guardada', userSession.getSessionId() ? 'sí' : 'no');
        const valid = await panaccessService.validateSession();
        log('validateSession', valid);
        const bouquets = await getBouquetsWithChannels();
        log('bouquets', bouquets.length, 'canales', bouquets.reduce((n, b) => n + b.items.length, 0));
        const first = bouquets[0]?.items?.[0];
        if (first) log('primer canal', first.name, String(first.url).replace(/sessionId=[^&]+/, 'sessionId=…'));
      } catch (e) {
        log('ERROR', e?.message, e?.errorInfo ? JSON.stringify(e.errorInfo) : '');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView>
        {lines.map((l, i) => (
          <Text key={i} style={styles.line}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#000', padding: 32},
  line: {color: '#9cf', fontSize: 22},
});
