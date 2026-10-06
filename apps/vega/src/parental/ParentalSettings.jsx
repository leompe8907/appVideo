import * as React from 'react';
import {useMemo, useState} from 'react';
import {Image, Pressable, ScrollView, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {getActiveBrandConfig, isParentalControlEnabledForBrand} from '@appvideo/core/config/brandConfig';
import {usePreloadStore} from '@appvideo/core/store/preloadStore';
import {useParentalStore} from '@appvideo/core/store/parentalStore';
import {useParentalGateStore} from '@appvideo/core/store/parentalGateStore';
import {getChannelStableId} from '@appvideo/core/utils/channelId';
import {buildChannelLogoUrl} from '@appvideo/core/utils/bouquetLayoutConfig';
import {PinModal} from './PinModal';
import {ConfirmModal} from '../components/ConfirmModal';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

const t = (key, opts) => i18n.t(key, opts);

const RATING_OPTIONS = [
  {key: 'none', label: () => t('parental.ratingNoRestrictions')},
  {key: 'L', label: () => t('parental.ratingLivreShort'), value: 0},
  {key: '10', label: () => '10', value: 10},
  {key: '12', label: () => '12', value: 12},
  {key: '14', label: () => '14', value: 14},
  {key: '16', label: () => '16', value: 16},
  {key: '18', label: () => '18', value: 18},
];

function Btn({label, onPress, active, colors, hasTVPreferredFocus, style}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.btn,
        {backgroundColor: active ? colors.activeBg : 'rgba(255,255,255,0.1)', borderColor: focused ? colors.focus : 'transparent'},
        style,
      ]}>
      <Text style={[styles.btnText, {color: active ? colors.activeText : colors.text}]}>{label}</Text>
    </Pressable>
  );
}

function ChannelToggle({channel, blocked, onPress, colors}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  const logo = buildChannelLogoUrl(channel, getActiveBrandConfig()?.drm) || channel?.img;
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.channel, {borderColor: focused ? colors.focus : 'rgba(255,255,255,0.12)'}, blocked && styles.channelBlocked]}>
      <Image source={logo ? {uri: logo} : theme.assets.placeholder} style={styles.channelLogo} resizeMode="contain" />
      <Text style={[styles.channelName, {color: colors.text}]} numberOfLines={1}>
        {channel?.lcn != null ? `${channel.lcn} ` : ''}
        {channel?.name}
      </Text>
      <Text style={[styles.channelState, {color: blocked ? '#ff8080' : 'rgba(255,255,255,0.6)'}]}>
        {blocked ? `🔒 ${t('parental.blocked')}` : t('parental.block')}
      </Text>
    </Pressable>
  );
}

/** Control parental (ParentalSettingsPage de la web), dentro de Mi Cuenta. */
export function ParentalSettings({colors}) {
  const parental = useParentalStore();
  const requestPlayChannel = useParentalGateStore((s) => s.requestPlayChannel);
  const streams = usePreloadStore((s) => s.epg.streams);
  const [pinStep, setPinStep] = useState(''); // '' | 'verify-old' | 'set-new'
  const [pinMsg, setPinMsg] = useState('');
  const [forgot, setForgot] = useState(false);

  const channels = useMemo(() => [...(streams || [])].sort((a, b) => Number(a.lcn ?? 0) - Number(b.lcn ?? 0)), [streams]);

  if (!isParentalControlEnabledForBrand(getActiveBrandConfig())) {
    return <Text style={[styles.subtitle, {color: colors.text}]}>{t('parental.disabledByBrand')}</Text>;
  }

  const hasPin = parental.hasPinConfigured();
  const unlockActive = parental.enabled && parental.unlockUntilMs != null && Date.now() < parental.unlockUntilMs;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={[styles.title, {color: colors.title}]}>{t('parental.title')}</Text>
      <Text style={[styles.subtitle, {color: colors.text}]}>{t('parental.subtitle')}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.label, {color: colors.text}]}>{t('parental.enabled')}</Text>
          <Btn
            label={parental.enabled ? t('parental.statusEnabled') : t('parental.statusDisabled')}
            active={parental.enabled}
            colors={colors}
            hasTVPreferredFocus
            onPress={() => parental.setEnabled(!parental.enabled)}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={[styles.label, {color: colors.text}]}>{t('parental.pin')}</Text>
          <View style={styles.inline}>
            <Btn
              label={hasPin ? t('parental.changePin') : t('parental.setPin')}
              colors={colors}
              onPress={() => {
                setPinMsg('');
                setPinStep(hasPin ? 'verify-old' : 'set-new');
              }}
            />
            {hasPin ? <Btn label={t('parental.forgotPin')} colors={colors} onPress={() => setForgot(true)} /> : null}
            <Btn label={t('parental.lockNow')} colors={colors} onPress={() => parental.lockNow()} />
          </View>
        </View>
        {pinMsg ? <Text style={[styles.msg, {color: colors.text}]}>{pinMsg}</Text> : null}
        {unlockActive ? <Text style={[styles.msg, {color: colors.text}]}>{t('parental.unlockActive')}</Text> : null}
        <View style={styles.divider} />
        <Text style={[styles.label, {color: colors.text}]}>{t('parental.ratingTitle')}</Text>
        <Text style={[styles.hint, {color: colors.text}]}>{t('parental.ratingHint')}</Text>
        <View style={styles.inline}>
          <Text style={[styles.hint, {color: colors.text}]}>{t('parental.ratingAllowUpTo')}</Text>
          {RATING_OPTIONS.map((opt) => {
            const active =
              opt.key === 'none'
                ? parental.ratingEnabled !== true
                : parental.ratingEnabled === true && Number(parental.ratingAllowedMax ?? 18) === opt.value;
            return (
              <Btn
                key={opt.key}
                label={opt.label()}
                active={active}
                colors={colors}
                style={styles.segment}
                onPress={() => {
                  if (opt.key === 'none') {
                    parental.setRatingEnabled(false);
                    return;
                  }
                  parental.setRatingEnabled(true);
                  parental.setRatingAllowedMax(opt.value);
                }}
              />
            );
          })}
        </View>
        {parental.ratingEnabled ? (
          <Btn
            label={`${parental.ratingApplyToLive !== false ? '☑' : '☐'} ${t('parental.ratingApplyToLive')}`}
            colors={colors}
            style={styles.checkbox}
            onPress={() => parental.setRatingApplyToLive(parental.ratingApplyToLive === false)}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={[styles.label, {color: colors.text}]}>{t('parental.channels')}</Text>
        {channels.length === 0 ? (
          <Text style={[styles.hint, {color: colors.text}]}>{t('parental.noChannels')}</Text>
        ) : (
          <View style={styles.grid}>
            {channels.map((ch) => {
              const id = getChannelStableId(ch);
              const blocked = parental.isChannelBlocked(id);
              return (
                <ChannelToggle
                  key={id || ch.lcn || ch.name}
                  channel={ch}
                  blocked={blocked}
                  colors={colors}
                  onPress={() => {
                    // Desbloquear pide PIN si el control está activo; bloquear no (como la web).
                    if (parental.enabled && hasPin && blocked) {
                      requestPlayChannel({
                        channel: ch,
                        title: t('parental.confirmChangeTitle'),
                        message: t('parental.confirmChangeMessage'),
                        purpose: 'action',
                        playFn: () => parental.toggleBlock(id),
                      });
                      return;
                    }
                    parental.toggleBlock(id);
                  }}
                />
              );
            })}
          </View>
        )}
      </View>

      {pinStep === 'verify-old' ? (
        <PinModal
          title={t('parental.changePin')}
          message={t('parental.enterCurrentPin')}
          onCancel={() => setPinStep('')}
          onSubmit={async (pin) => {
            const ok = await parental.verifyPin(pin);
            if (ok) setPinStep('set-new');
            return ok;
          }}
        />
      ) : null}
      {pinStep === 'set-new' ? (
        <PinModal
          title={t('parental.setPinTitle')}
          message={t('parental.enterNewPin')}
          onCancel={() => setPinStep('')}
          onSubmit={async (pin) => {
            if (String(pin).length < 4) {
              setPinMsg(t('parental.pinMin'));
              return false;
            }
            try {
              await parental.setPin(pin);
              setPinMsg(t('parental.pinSaved'));
              setPinStep('');
              return true;
            } catch {
              setPinMsg(t('parental.pinError'));
              return false;
            }
          }}
        />
      ) : null}
      {forgot ? (
        <ConfirmModal
          title={t('parental.forgotPinTitle')}
          message={t('parental.forgotPinMessage')}
          confirmLabel={t('common.close')}
          onConfirm={() => setForgot(false)}
          onCancel={() => setForgot(false)}
        />
      ) : null}
    </ScrollView>
  );
}

// _parental.scss, escalado como el resto de Mi Cuenta.
const styles = createScaledStyles({
  page: {paddingBottom: 40},
  title: {fontSize: 34, fontWeight: '700', marginBottom: 8, paddingRight: 110},
  subtitle: {fontSize: 22, opacity: 0.8, marginBottom: 20},
  card: {padding: 24, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 20},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'},
  inline: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8},
  label: {fontSize: 24, fontWeight: '600'},
  hint: {fontSize: 20, opacity: 0.75, marginTop: 6},
  msg: {fontSize: 20, marginTop: 10},
  divider: {height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 18},
  btn: {paddingVertical: 10, paddingHorizontal: 22, borderRadius: 10, borderWidth: 3},
  btnText: {fontSize: 20, fontWeight: '600'},
  segment: {paddingHorizontal: 18},
  checkbox: {alignSelf: 'flex-start', marginTop: 12},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12},
  channel: {width: 200, padding: 12, borderRadius: 12, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center'},
  channelBlocked: {backgroundColor: 'rgba(255,80,80,0.12)'},
  channelLogo: {width: 150, height: 70},
  channelName: {fontSize: 18, fontWeight: '600', marginTop: 6},
  channelState: {fontSize: 16, marginTop: 4},
});
