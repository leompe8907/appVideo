import * as React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import panaccessService from '@appvideo/core/services/panaccessService';
import {isLicenseInUseError} from '@appvideo/core/utils/licenseInUse';
import {getActiveLicense, setActiveLicense, setLicenses as storeLicenses, setLoggedOut} from '@appvideo/core/utils/userSession';
import {
  filterLicensesForDisplay,
  findLicenseByKey,
  getLicenseKey,
  getLicensePin,
  getLicenseProducts,
} from '@appvideo/core/utils/licenseProducts';
import {FocusRing} from '../components/FocusRing';
import {MessageModal} from '../components/MessageModal';
import {FullScreenImage} from '../components/FullScreenImage';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

const t = (key, opts) => i18n.t(key, opts);

function getLicensesArray(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.answer ?? response.licenses ?? response.list ?? response.data ?? [];
}

function FocusableItem({onPress, disabled, hasTVPreferredFocus, radius = 8, style, children}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.itemWrap}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        hasTVPreferredFocus={hasTVPreferredFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[style, disabled && styles.disabled]}>
        {children}
      </Pressable>
      <FocusRing visible={focused} radius={radius} />
    </View>
  );
}

/**
 * Selección de smartcard / licencia (SmartCardPage de la web): lista las
 * licencias con pantallas libres, activa la elegida y, si está en uso,
 * pregunta si continuar acá. Si ya hay una licencia activa válida la activa
 * sola. "Cerrar sesión" vuelve al login.
 */
export function SmartCardScreen({navigate}) {
  const theme = getTheme();
  const [licenses, setLicenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultError, setResultError] = useState(null);
  const [setting, setSetting] = useState(false);
  const [confirmInUse, setConfirmInUse] = useState(null);
  const allValid = useRef([]);
  const autoAttempted = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await panaccessService.getStreamingLicenses({withPins: true});
        const valid = getLicensesArray(response).filter((l) => getLicenseKey(l));
        allValid.current = valid;
        const filtered = filterLicensesForDisplay(valid);
        setLicenses(filtered);
        if (filtered.length > 0) storeLicenses(filtered);
      } catch (err) {
        devLog('smartcard: error', err?.message);
        setError(err?.message || t('smartcard.errorFetch'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activate = useCallback(
    async (licenseKey, pin, failIfInUse = true) => {
      setSetting(true);
      setResultError(null);
      try {
        await panaccessService.setStreamingLicense({licenseKey, pin, failIfInUse});
        setActiveLicense({licenseKey, pin});
        navigate('home');
      } catch (err) {
        devLog('smartcard: setStreamingLicense', err?.message);
        if (failIfInUse && isLicenseInUseError(err)) setConfirmInUse({licenseKey, pin});
        else setResultError(err?.errorInfo?.userMessage || err?.message || t('smartcard.errorSet'));
      } finally {
        setSetting(false);
      }
    },
    [navigate],
  );

  // Con una licencia activa guardada que sigue existiendo, activarla sola.
  useEffect(() => {
    if (autoAttempted.current || loading || error || !licenses?.length) return;
    const active = getActiveLicense();
    const key = active?.licenseKey ? String(active.licenseKey).trim() : '';
    if (!key || !findLicenseByKey(allValid.current, key)) return;
    autoAttempted.current = true;
    activate(key, active?.pin != null ? String(active.pin) : '');
  }, [loading, error, licenses, activate]);

  const logout = () => {
    try {
      panaccessService.logout();
    } catch {
      // noop
    }
    setLoggedOut();
    navigate('login');
  };

  const selectLicense = (license) => {
    if (setting) return;
    const key = getLicenseKey(license);
    if (!key) {
      setResultError(t('smartcard.errorNoKey'));
      return;
    }
    activate(key, getLicensePin(license));
  };

  const list = Array.isArray(licenses) ? licenses : [];

  return (
    <View style={styles.page}>
      <FullScreenImage source={theme.assets.background} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>{t('smartcard.loadingLicenses')}</Text>
        </View>
      ) : error || list.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || t('smartcard.noLicenses')}</Text>
          <FocusableItem onPress={logout} hasTVPreferredFocus radius={8} style={styles.backButton}>
            <Text style={styles.itemTitle}>{t('smartcard.logout')}</Text>
          </FocusableItem>
        </View>
      ) : (
        <View style={styles.content}>
          <Image source={theme.logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.instructions}>{t('smartcard.instructionsNoPIN', {appName: theme.appName})}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {list.map((license, index) => {
              const products = getLicenseProducts(license);
              const name = license?.licenseName ?? license?.name;
              return (
                <FocusableItem
                  key={index}
                  onPress={() => selectLicense(license)}
                  disabled={setting}
                  hasTVPreferredFocus={index === 0}
                  style={styles.item}>
                  <Text style={styles.itemTitle}>{getLicenseKey(license)}</Text>
                  {products ? <Text style={styles.itemProducts}>{products}</Text> : null}
                  {name ? <Text style={styles.itemName}>{String(name)}</Text> : null}
                </FocusableItem>
              );
            })}
            <FocusableItem onPress={logout} disabled={setting} style={[styles.item, styles.itemLogout]}>
              <Text style={[styles.itemTitle, styles.center]}>{t('smartcard.logout')}</Text>
            </FocusableItem>
          </ScrollView>
          {setting ? (
            <View style={[StyleSheet.absoluteFill, styles.settingOverlay]}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>{t('smartcard.settingLicense')}</Text>
            </View>
          ) : null}
        </View>
      )}

      {confirmInUse ? (
        <Modal transparent visible onRequestClose={() => setConfirmInUse(null)}>
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmModal}>
              <Text style={styles.confirmTitle}>{t('smartcard.licenseInUseConfirm')}</Text>
              <View style={styles.confirmActions}>
                <FocusableItem
                  hasTVPreferredFocus
                  onPress={() => {
                    const {licenseKey, pin} = confirmInUse;
                    setConfirmInUse(null);
                    activate(licenseKey, pin, false);
                  }}
                  style={styles.confirmButton}>
                  <Text style={styles.itemTitle}>{t('smartcard.licenseInUseYes')}</Text>
                </FocusableItem>
                <FocusableItem onPress={() => setConfirmInUse(null)} style={styles.confirmButton}>
                  <Text style={styles.itemTitle}>{t('smartcard.licenseInUseNo')}</Text>
                </FocusableItem>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {resultError ? <MessageModal message={resultError} onClose={() => setResultError(null)} /> : null}
    </View>
  );
}

// Medidas de _smartcard.scss a 1920×1080 (1rem = 16px).
const styles = createScaledStyles({
  page: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000'},
  overlay: {backgroundColor: 'rgba(0,0,0,0.5)'},
  center: {alignItems: 'center', justifyContent: 'center', textAlign: 'center'},
  content: {width: 560},
  // La web no muestra logo en esta pantalla; en TV se agrega (mismo tamaño que en el login).
  logo: {width: 176, height: 40, alignSelf: 'center', marginBottom: 24},
  instructions: {fontSize: 16, color: 'rgba(255,255,255,0.95)', marginBottom: 12},
  list: {
    height: 320,
    flexGrow: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  listContent: {padding: 16},
  itemWrap: {marginVertical: 4},
  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(42,42,42,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  itemLogout: {marginTop: 8, alignItems: 'center'},
  itemTitle: {color: '#fff', fontSize: 14.4, fontWeight: '600'},
  itemProducts: {color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4},
  itemName: {color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 3},
  disabled: {opacity: 0.6},
  loadingText: {color: '#fff', fontSize: 16, marginTop: 16},
  errorText: {color: '#fff', fontSize: 16, marginBottom: 20, textAlign: 'center'},
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(42,42,42,0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  settingOverlay: {backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', borderRadius: 12},
  confirmOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center'},
  confirmModal: {
    width: 400,
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(42,42,42,0.95)',
  },
  confirmTitle: {color: '#fff', fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 16},
  confirmActions: {flexDirection: 'row', justifyContent: 'center', gap: 12},
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
});
