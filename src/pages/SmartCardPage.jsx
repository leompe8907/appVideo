import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { MessageModal } from '../components/MessageModal';
import panaccessService from '../services/panaccessService';
import { isLicenseInUseError } from '../utils/licenseInUse';
import {
  setLoggedOut,
  setLicenses as storeLicenses,
  getActiveLicense,
  setActiveLicense,
} from '../utils/userSession';
import { useDevice } from '../contexts/DeviceContext';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
import '../styles/pages/_smartcard.scss';

// Normaliza la estructura de una licencia (alineado con 10foot)
const normalizeLicense = (license) => {
  if (!license || typeof license !== 'object') {
    return { key: '', pin: '', active: false, products: '', licenseName: '' };
  }
  const key = license.KEY || license.key || license.licenseKey || license.Key || '';
  const pin = license.pin || license.PIN || license.Pin || '';
  const active = license.active === true;
  const products = typeof license.products === 'string' ? license.products : '';
  const licenseName = license.licenseName != null ? String(license.licenseName) : (license.name != null ? String(license.name) : '');
  return { key, pin, active, products, licenseName };
};

function getLicensesArray(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.answer ?? response.licenses ?? response.list ?? response.data ?? [];
}

function filterLicensesWithProducts(licenses) {
  const withProducts = licenses.filter((l) => {
    const p = l?.products;
    return p !== undefined && p !== null && typeof p === 'string' && p.trim() !== '';
  });
  return withProducts.length > 0 ? withProducts : licenses;
}

export function SmartCardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, getImage } = useBrand();

  const [licenses, setLicenses] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultModal, setResultModal] = useState(null);
  const [isSettingLicense, setIsSettingLicense] = useState(false);
  const [confirmLicenseInUse, setConfirmLicenseInUse] = useState(null);

  // Backstop: si ya existe una licencia activa en storage, activarla automáticamente
  // para que el usuario no quede atascado en esta pantalla.
  const autoActivateAttemptedRef = useRef(false);
  const { isTV } = useDevice();
  const { setFocus } = useSpatialNavigation();

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await panaccessService.getStreamingLicenses({ withPins: true });
        const list = getLicensesArray(response);
        const valid = list
          .map((l) => ({ raw: l, norm: normalizeLicense(l) }))
          .filter(({ norm }) => norm.key && String(norm.key).trim().length > 0)
          .map(({ raw }) => raw);
        const filtered = filterLicensesWithProducts(valid);
        setLicenses(filtered);
        if (filtered.length > 0) {
          storeLicenses(filtered);
        }
        
        // Asignar primer foco si estamos en TV
        if (isTV) {
          setTimeout(() => {
            if (typeof setFocus === 'function') {
              setFocus('license-list-item-0');
            }
          }, 400);
        }
      } catch (err) {
        console.error('[SMARTCARD] Error:', err);
        setError(err.message || t('smartcard.errorFetch'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchLicenses();
  }, [t]);

  useEffect(() => {
    if (autoActivateAttemptedRef.current) return;
    if (isLoading || !!error) return;
    if (!licenses || licenses.length === 0) return;

    const active = getActiveLicense?.();
    const activeKey = active?.licenseKey ? String(active.licenseKey).trim() : '';
    const activePin = active?.pin != null ? String(active.pin) : '';
    if (!activeKey) return;

    const matching = licenses.find((l) => {
      const norm = normalizeLicense(l);
      return norm.key && String(norm.key).trim() === activeKey;
    });

    if (!matching) return;
    autoActivateAttemptedRef.current = true;

    const activate = async () => {
      try {
        setIsSettingLicense(true);
        setError(null);
        setResultModal(null);
        setConfirmLicenseInUse(null);

        await panaccessService.setStreamingLicense({
          licenseKey: activeKey,
          pin: activePin,
          failIfInUse: true,
        });
        setActiveLicense({ licenseKey: activeKey, pin: activePin });

        // Para esta ruta esperamos que las marcas sin profiles vayan directo a home/bouquets.
        navigate('/home/inicio');
      } catch (err) {
        console.error('[SMARTCARD] Auto-activate error:', err);
        if (isLicenseInUseError(err)) {
          setConfirmLicenseInUse({ licenseKey: activeKey, pin: activePin });
        } else {
          setError(err?.errorInfo?.userMessage || err?.message || t('smartcard.errorSet'));
        }
      } finally {
        setIsSettingLicense(false);
      }
    };

    activate();
  }, [isLoading, error, licenses, navigate, t]);

  const handleBack = () => {
    panaccessService.logout();
    setLoggedOut();
    navigate('/login');
  };

  const handleLicenseSelect = async (license, failIfInUse = true) => {
    if (isSettingLicense) return;
    const licenseKey = license.KEY || license.key || license.licenseKey || license.Key || '';
    const pin = license.pin || license.PIN || license.Pin || '';
    if (!licenseKey) {
      setResultModal({ type: 'error', text: t('smartcard.errorNoKey') });
      return;
    }

    try {
      setIsSettingLicense(true);
      setError(null);
      setResultModal(null);
      setConfirmLicenseInUse(null);

      await panaccessService.setStreamingLicense({ licenseKey, pin, failIfInUse });
      setActiveLicense({ licenseKey, pin });
      // Al seleccionar una tarjeta, se debe ingresar directamente (sin modal de bienvenida).
      navigate('/home/inicio', { replace: true });
    } catch (err) {
      console.error('[SMARTCARD] Error al establecer licencia:', err);
      if (failIfInUse && isLicenseInUseError(err)) {
        setConfirmLicenseInUse({ licenseKey, pin });
      } else {
        setResultModal({
          type: 'error',
          text: err?.errorInfo?.userMessage || err?.message || t('smartcard.errorSet'),
        });
      }
    } finally {
      setIsSettingLicense(false);
    }
  };

  const handleConfirmLicenseInUse = (accept) => {
    if (!accept || !confirmLicenseInUse) {
      setConfirmLicenseInUse(null);
      return;
    }
    handleLicenseSelect(
      { key: confirmLicenseInUse.licenseKey, pin: confirmLicenseInUse.pin },
      false
    );
    setConfirmLicenseInUse(null);
  };

  const validLicenses = licenses && Array.isArray(licenses) ? licenses : [];

  return (
    <div
      className="smartcard-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      {resultModal?.type === 'error' && (
        <MessageModal
          type={resultModal.type}
          message={resultModal.text}
          onClose={() => {
            setResultModal(null);
          }}
        />
      )}

      {confirmLicenseInUse && (
        <div className="confirm-in-use-overlay" role="dialog" aria-modal="true">
          <div className="confirm-in-use-modal">
            <h4 className="confirm-in-use-title">{t('smartcard.licenseInUseConfirm')}</h4>
            <div className="confirm-in-use-actions">
              <FocusableConfirmButton
                onClick={() => handleConfirmLicenseInUse(true)}
                focusKey="smartcard-confirm-yes"
              >
                {t('smartcard.licenseInUseYes')}
              </FocusableConfirmButton>
              <FocusableConfirmButton
                onClick={() => handleConfirmLicenseInUse(false)}
                focusKey="smartcard-confirm-no"
              >
                {t('smartcard.licenseInUseNo')}
              </FocusableConfirmButton>
            </div>
          </div>
        </div>
      )}

      <div className="smartcard-overlay" />
      <div className="smartcard-container">
        {isLoading && (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p className="loading-text">{t('smartcard.loadingLicenses')}</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <p className="error-text">{error}</p>
            <button type="button" className="back-button" onClick={handleBack}>
              {t('smartcard.logout')}
            </button>
          </div>
        )}

        {!isLoading && !error && validLicenses.length > 0 && (
          <div className="smartcard-content smartcard-content-list">
            {isSettingLicense && (
              <div className="setting-license-overlay">
                <div className="loading-spinner" />
                <p className="loading-text">{t('smartcard.settingLicense')}</p>
              </div>
            )}
            <h4 className="smartcard-instructions" id="smartcard-instructions-label">
              {t('smartcard.instructionsNoPIN')}
            </h4>
            <div className="licenses-list" role="list" aria-labelledby="smartcard-instructions-label">
              {validLicenses.map((license, index) => (
                <LicenseListItem
                  key={index}
                  license={license}
                  index={index}
                  onSelect={() => handleLicenseSelect(license)}
                  isSettingLicense={isSettingLicense}
                />
              ))}
              <LicenseListLogoutItem onLogout={handleBack} isSettingLicense={isSettingLicense} />
            </div>
          </div>
        )}

        {!isLoading && !error && licenses && validLicenses.length === 0 && (
          <div className="no-data-container">
            <p className="no-licenses">{t('smartcard.noLicenses')}</p>
            <button type="button" className="back-button" onClick={handleBack}>
              {t('smartcard.logout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FocusableConfirmButton({ children, onClick, focusKey }) {
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    focusKey: focusKey || undefined,
    onEnterPress: onClick,
    isFocusable: true,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`confirm-in-use-btn ${focused ? 'focused' : ''}`}
      onClick={onClick}
      tabIndex={isTV ? -1 : 0}
    >
      {children}
    </button>
  );
}

function LicenseListItem({ license, index, onSelect, isSettingLicense }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const norm = normalizeLicense(license);

  const { ref, focused } = useSpatialNavigation({
    focusKey: `license-list-item-${index}`,
    onEnterPress: () => {
      if (!isSettingLicense) onSelect();
    },
    isFocusable: !isSettingLicense,
  });

  const handleClick = () => {
    if (!isSettingLicense) onSelect();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isSettingLicense) onSelect();
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`license-list-item ${focused ? 'focused' : ''} ${isSettingLicense ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isTV ? -1 : 0}
      role="listitem"
      aria-label={t('smartcard.selectLicense', { title: norm.key || t('smartcard.licenseNumber', { index: index + 1 }) })}
    >
      <b>{norm.key}</b>
      {norm.products && <p className="license-list-products">{norm.products}</p>}
      {norm.licenseName && <b className="license-list-name">{norm.licenseName}</b>}
    </button>
  );
}

function LicenseListLogoutItem({ onLogout, isSettingLicense }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    focusKey: 'license-list-item-logout',
    onEnterPress: () => {
      if (!isSettingLicense) onLogout();
    },
    isFocusable: !isSettingLicense,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`license-list-item license-list-item-logout ${focused ? 'focused' : ''} ${isSettingLicense ? 'disabled' : ''}`}
      onClick={() => !isSettingLicense && onLogout()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isSettingLicense) {
          e.preventDefault();
          onLogout();
        }
      }}
      tabIndex={isTV ? -1 : 0}
      role="listitem"
      aria-label={t('smartcard.logout')}
    >
      <b>{t('smartcard.logout')}</b>
    </button>
  );
}

export default SmartCardPage;
