import * as React from 'react';
import {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {useOsmsStore} from '@appvideo/core/store/osmsStore';
import {captureInitialUnreadIds, formatCardDate, formatFullDate, groupOsmsByDay, previewText} from '@appvideo/core/utils/osmsFormat';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);

function MessageRow({message, unread, selected, colors, onPress, hasTVPreferredFocus}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onPress();
      }}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={[styles.row, selected && {backgroundColor: colors.activeBg}, focused && {borderColor: colors.focus}]}>
      <View style={styles.rowHead}>
        {unread ? <View style={[styles.dot, {backgroundColor: colors.focus}]} /> : null}
        <Text style={[styles.rowDate, {color: colors.text}]}>{formatCardDate(message.time, i18n.language)}</Text>
      </View>
      <Text style={[styles.rowText, {color: colors.text}]} numberOfLines={2}>
        {previewText(message.message, 90) || t('osms.noMessage')}
      </Text>
    </Pressable>
  );
}

/**
 * Mensajes del operador dentro de Mi Cuenta (OsmsPage de la web, modo inline):
 * lista agrupada por día y detalle del mensaje con foco. Al abrirla quedan
 * marcados como vistos (baja el contador del menú).
 */
export function OsmsPanel({colors, openOsmId}) {
  const items = useOsmsStore((s) => s.items);
  const status = useOsmsStore((s) => s.status);
  const hasNew = useOsmsStore((s) => s.hasNew);
  const unreadCount = useOsmsStore((s) => s.unreadCount);
  const refreshOsms = useOsmsStore((s) => s.refreshOsms);
  const markAsSeen = useOsmsStore((s) => s.markAsSeen);
  const [selectedId, setSelectedId] = useState(openOsmId ?? null);
  // Los no leídos se fijan al abrir, antes de marcar como vistos (este efecto corre antes que el de markAsSeen).
  const [initialUnread, setInitialUnread] = useState(null);
  useEffect(() => {
    if (initialUnread == null && items.length) setInitialUnread(captureInitialUnreadIds(items, hasNew, unreadCount));
  }, [initialUnread, items, hasNew, unreadCount]);

  useEffect(() => {
    refreshOsms({force: false});
  }, [refreshOsms]);

  useEffect(() => {
    if (items.length) markAsSeen();
  }, [items.length, markAsSeen]);

  const groups = useMemo(() => groupOsmsByDay(items, t), [items]);
  const selected = items.find((m) => String(m.id) === String(selectedId)) || items[0] || null;
  const preferredId = String(openOsmId ?? items[0]?.id ?? '');

  if (!items.length) {
    return (
      <View>
        <Text style={[styles.title, {color: colors.title}]}>{t('osms.title')}</Text>
        <Text style={[styles.empty, {color: colors.text}]}>
          {status === 'loading' ? t('common.loading') : `${t('osms.empty')} ${t('osms.emptyHint')}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Text style={[styles.title, {color: colors.title}]}>{t('osms.title')}</Text>
      <View style={styles.columns}>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.label}>
              <Text style={[styles.group, {color: colors.title}]}>{g.label}</Text>
              {g.items.map((m) => (
                <MessageRow
                  key={String(m.id)}
                  message={m}
                  colors={colors}
                  unread={Boolean(initialUnread?.has(String(m.id))) && String(m.id) !== String(selected?.id)}
                  selected={String(m.id) === String(selected?.id)}
                  hasTVPreferredFocus={String(m.id) === preferredId}
                  onPress={() => setSelectedId(m.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
        <ScrollView style={styles.detail} showsVerticalScrollIndicator={false}>
          {selected ? (
            <>
              <Text style={[styles.detailDate, {color: colors.text}]}>{formatFullDate(selected.time, i18n.language)}</Text>
              <Text style={[styles.detailText, {color: colors.text}]}>{selected.message || t('osms.noMessage')}</Text>
            </>
          ) : (
            <Text style={[styles.empty, {color: colors.text}]}>{t('osms.selectOne')}</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = createScaledStyles({
  page: {flex: 1},
  title: {fontSize: 36, fontWeight: '700', marginBottom: 20},
  columns: {flex: 1, flexDirection: 'row'},
  list: {width: 520, flexGrow: 0, marginRight: 32},
  group: {fontSize: 22, fontWeight: '700', marginTop: 12, marginBottom: 8},
  row: {padding: 16, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', marginBottom: 8},
  rowHead: {flexDirection: 'row', alignItems: 'center', marginBottom: 6},
  dot: {width: 12, height: 12, borderRadius: 6, marginRight: 10},
  rowDate: {fontSize: 20, opacity: 0.8},
  rowText: {fontSize: 22},
  detail: {flex: 1},
  detailDate: {fontSize: 22, opacity: 0.8, marginBottom: 16},
  detailText: {fontSize: 26, lineHeight: 38},
  empty: {fontSize: 24, opacity: 0.85},
});
