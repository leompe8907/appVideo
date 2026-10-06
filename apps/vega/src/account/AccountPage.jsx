import * as React from 'react';
import {useState} from 'react';
import {BackHandler, Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig, isParentalControlEnabledForBrand} from '@appvideo/core/config/brandConfig';
import {clearSessionBeforeNewLogin} from '@appvideo/core/services/loginFlow';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {getActiveLicense, getCredentials} from '@appvideo/core/utils/userSession';
import {QrCode} from '../components/QrCode';
import {ConfirmModal} from '../components/ConfirmModal';
import {formatTime} from '../epg';
import {resetHomeMemory} from '../homeMemory';
import {createScaledStyles, px} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);

const LINKS = [
  {key: 'changePassword', label: 'account.changePassword', step3: 'account.step3ChangePassword'},
  {key: 'linkedDevices', label: 'account.linkedDevices', step3: 'account.step3LinkedDevices'},
  {key: 'subscription', label: 'account.subscription', step3: 'account.step3Subscription'},
];

/** `inTV&#174,` → `inTV®,` (developedBy llega con entidades HTML). */
function decodeEntities(s) {
  return String(s || '').replace(/&#(\d+);?/g, (_, n) => String.fromCharCode(Number(n)));
}

function MenuItem({label, active, danger, onPress, hasTVPreferredFocus, colors}) {
  const [focused, setFocused] = useState(false);
  const bg = active ? (danger ? colors.danger : colors.activeBg) : focused ? 'rgba(255,255,255,0.08)' : 'transparent';
  const color = active ? (danger ? '#1a1a1a' : colors.activeText) : danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.item, {backgroundColor: bg}, focused && {borderColor: colors.focus}]}>
      <Text style={[styles.itemText, {color}, active && styles.itemTextActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Mi Cuenta (MiCuentaPage de la web en TV, spec 2 §5): menú según
 * `account.links` / `account.sections`; los links se muestran como QR con
 * pasos; "Acerca de"; Refrescar; Cerrar sesión y Salir con confirmación.
 */
export function AccountPage({navigate, active = true}) {
  const brand = getActiveBrandConfig();
  const account = brand?.account || {};
  const th = account.theme || {};
  const colors = {
    sidebarBg: th.sidebarBg || '#0b2a4a',
    contentBg: th.contentBg || '#061a2e',
    text: th.panelText || 'rgba(255,255,255,0.88)',
    activeBg: th.activeItemBg || '#5c8fc4',
    activeText: th.activeItemText || '#ffffff',
    divider: th.dividerColor || 'rgba(255,255,255,0.18)',
    title: th.contentTitleColor || '#8fb9e8',
    qrBg: th.qrBackground || '#9dc3ec',
    stepBg: th.stepNumberBg || '#12365c',
    stepText: th.stepNumberText || '#ffffff',
    danger: th.dangerText || '#ff8080',
    focus: brand?.ui?.focus?.color || '#3355FF',
  };
  const sections = account.sections || {};
  const links = LINKS.filter((l) => account.links?.[l.key]?.enabled !== false);
  const deleteLink = account.links?.deleteAccount?.enabled !== false ? {key: 'deleteAccount', label: 'account.deleteAccount', step3: 'account.step3DeleteAccount'} : null;
  const [selected, setSelected] = useState(links[0]?.key || 'about');
  const [confirm, setConfirm] = useState(null); // 'logout' | 'exit'
  const loadEPG = usePreloadStore((s) => s.loadEPG);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);

  const refresh = () => {
    loadEPG(brand, {force: true});
    loadVOD(brand, {t, force: true});
    if (brand?.catchup?.enabled !== false) loadCatchup(brand, {force: true});
    setSelected('refresh');
  };

  const selectedLink = [...links, deleteLink].find((l) => l && l.key === selected);
  let content;
  if (selectedLink) {
    const url = account.links?.[selectedLink.key]?.url || '';
    content = (
      <>
        <Text style={[styles.contentTitle, {color: colors.title}]}>{t(selectedLink.label)}</Text>
        <View style={styles.qrRow}>
          <View style={[styles.qrBox, {backgroundColor: colors.qrBg}]}>
            {url ? <QrCode value={url} size={px(288)} background={colors.qrBg} /> : <Text style={styles.qrNotice}>{t('account.notConfigured')}</Text>}
          </View>
          <View style={styles.steps}>
            {[t('account.step1'), t('account.step2'), t(selectedLink.step3)].map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNum, {backgroundColor: colors.stepBg}]}>
                  <Text style={[styles.stepNumText, {color: colors.stepText}]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepText, {color: colors.text}]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      </>
    );
  } else if (selected === 'about') {
    const rows = [
      [t('account.aboutApp'), brand?.appName],
      [t('account.aboutBrand'), brand?.brand],
      [t('account.aboutVersion'), brand?.version],
      [t('account.aboutUsername'), getCredentials()?.username],
      [t('account.aboutSmartcard'), getActiveLicense()?.licenseKey],
      [t('account.aboutDevelopedBy'), decodeEntities(brand?.developedBy).replace(/,$/, '')],
      [t('account.aboutTimezone'), Intl.DateTimeFormat().resolvedOptions().timeZone],
    ].filter(([, v]) => v != null && String(v).trim() !== '');
    content = (
      <>
        <Text style={[styles.contentTitle, {color: colors.title}]}>{t('account.about')}</Text>
        <View style={styles.about}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, {color: colors.text}]}>{label}</Text>
              <Text style={[styles.aboutValue, {color: colors.text}]}>{String(value)}</Text>
            </View>
          ))}
        </View>
      </>
    );
  } else if (selected === 'refresh') {
    content = <Text style={[styles.contentTitle, {color: colors.title}]}>{t('account.refresh')} ✓</Text>;
  } else if (selected === 'parental') {
    content = (
      <>
        <Text style={[styles.contentTitle, {color: colors.title}]}>{t('account.advancedSettings')}</Text>
        <Text style={[styles.stepText, {color: colors.text}]}>{t('account.comingSoon')}</Text>
      </>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView style={[styles.menu, {backgroundColor: colors.sidebarBg}]} contentContainerStyle={styles.menuInner}>
        <Text style={[styles.menuTitle, {color: colors.text}]}>{t('account.title')}</Text>
        {links.map((l, i) => (
          <MenuItem key={l.key} label={t(l.label)} active={selected === l.key} colors={colors} hasTVPreferredFocus={active && i === 0} onPress={() => setSelected(l.key)} />
        ))}
        {links.length ? <View style={[styles.divider, {backgroundColor: colors.divider}]} /> : null}
        {sections.parentalControl !== false && isParentalControlEnabledForBrand(brand) ? (
          <MenuItem label={t('account.advancedSettings')} active={selected === 'parental'} colors={colors} onPress={() => setSelected('parental')} />
        ) : null}
        {sections.about !== false ? (
          <MenuItem label={t('account.about')} active={selected === 'about'} colors={colors} hasTVPreferredFocus={active && links.length === 0} onPress={() => setSelected('about')} />
        ) : null}
        {sections.refresh !== false ? <MenuItem label={t('account.refresh')} active={selected === 'refresh'} colors={colors} onPress={refresh} /> : null}
        {deleteLink ? <MenuItem label={t(deleteLink.label)} active={selected === deleteLink.key} colors={colors} onPress={() => setSelected(deleteLink.key)} /> : null}
        {sections.logout !== false ? <MenuItem label={t('common.logout')} colors={colors} onPress={() => setConfirm('logout')} /> : null}
        {sections.exitApp !== false ? <MenuItem label={t('account.exit')} danger colors={colors} onPress={() => setConfirm('exit')} /> : null}
      </ScrollView>

      <View style={[styles.content, {backgroundColor: colors.contentBg}]}>
        <Text style={[styles.clock, {color: colors.text}]}>{formatTime(Date.now())}</Text>
        {content}
      </View>

      {confirm === 'logout' ? (
        <ConfirmModal
          title={t('settings.logoutConfirmTitle')}
          message={t('settings.logoutConfirmMessage')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            clearSessionBeforeNewLogin();
            resetHomeMemory();
            navigate('login');
          }}
        />
      ) : null}
      {confirm === 'exit' ? (
        <ConfirmModal
          title={t('settings.exitConfirmTitle')}
          message={t('settings.exitConfirmMessage')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            BackHandler.exitApp();
          }}
        />
      ) : null}
    </View>
  );
}

// _mi-cuenta.scss (spec 2 §5.2). El contenido se agranda a la par del menú (la web lo deja en 16px).
const styles = createScaledStyles({
  page: {flex: 1, flexDirection: 'row'},
  menu: {flexGrow: 0, width: 486, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)'},
  menuInner: {paddingVertical: 36.5, paddingHorizontal: 27},
  menuTitle: {fontSize: 36.5, fontWeight: '700', marginTop: 6.75, marginHorizontal: 16.2, marginBottom: 27},
  divider: {height: 1, marginVertical: 23, marginHorizontal: 16.2},
  item: {paddingVertical: 18.5, paddingHorizontal: 23.8, borderRadius: 19.8, marginBottom: 4, borderWidth: 2, borderColor: 'transparent'},
  itemText: {fontSize: 26.5},
  itemTextActive: {fontWeight: '600'},
  content: {flex: 1, paddingTop: 28.1, paddingHorizontal: 34.6, paddingBottom: 30.2},
  clock: {position: 'absolute', top: 21.6, right: 28.1, fontSize: 28, opacity: 0.9, fontVariant: ['tabular-nums']},
  contentTitle: {fontSize: 34, fontWeight: '700', marginBottom: 28, paddingRight: 110},
  qrRow: {flexDirection: 'row', alignItems: 'center', marginTop: 24},
  qrBox: {width: 312, height: 312, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 12, marginRight: 56},
  qrNotice: {color: 'rgba(10,20,30,0.65)', fontSize: 20, textAlign: 'center', padding: 16},
  steps: {flex: 1, maxWidth: 672},
  step: {flexDirection: 'row', alignItems: 'center', marginBottom: 27},
  stepNum: {width: 39, height: 39, borderRadius: 19.5, alignItems: 'center', justifyContent: 'center', marginRight: 21},
  stepNumText: {fontSize: 19.2, fontWeight: '700'},
  stepText: {flex: 1, fontSize: 24, lineHeight: 33.6},
  about: {maxWidth: 816},
  aboutRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 21, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 15},
  aboutLabel: {fontSize: 24, opacity: 0.75},
  aboutValue: {fontSize: 24, fontWeight: '600'},
});
