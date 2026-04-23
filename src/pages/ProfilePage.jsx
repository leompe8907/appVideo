/**
 * Página de Perfiles de Usuario
 * Diseño moderno tipo OTT (Netflix, Disney+, HBO Max)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { DeleteProfileModal } from '../components/profile/DeleteProfileModal';
import { MessageModal } from '../components/MessageModal';
import { FocusableButton } from '../components/navigation/FocusableButton';
import AppIcon from '../components/AppIcon';
import panaccessService from '../services/panaccessService';
import { setLoggedOut } from '../utils/userSession';
import Img from '../constants/images';
import '../styles/pages/_profile.scss';

/**
 * Busca una imagen por su ID en el array de imágenes
 * @param {number} imageId - ID de la imagen a buscar
 * @returns {string|null} URL de la imagen o null si no se encuentra
 */
const getImageById = (imageId) => {
  const image = Img.find(img => img.id === imageId);
  return image ? image.img : null;
};

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentBrand, appName, getImage, isFeatureEnabled } = useBrand();
  const { isTV } = useDevice();

  const [profiles, setProfiles] = useState([]);
  const [smartCards, setSmartCards] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileMessage, setProfileMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState(null);

  // Si esta marca no tiene perfiles, redirigir a smartcard (evita acceso directo por URL)
  const profilesFeatureEnabled = currentBrand ? isFeatureEnabled('profiles') : true;
  useEffect(() => {
    if (currentBrand && !profilesFeatureEnabled) {
      navigate('/smartcard', { replace: true });
    }
  }, [currentBrand, profilesFeatureEnabled, navigate]);

  const handleBack = () => {
    panaccessService.logout();
    setLoggedOut();
    navigate('/login');
  };

  console.log(`🖥️ [PROFILE] Modo: ${isTV ? 'TV' : 'PC'}`);

  const fetchProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[PROFILE] Llamando a getClientConfig y getStreamingLicenses...');
      const [clientConfig, licensesResponse] = await Promise.all([
        panaccessService.getClientConfig({ enableRetry: false }),
        panaccessService.getStreamingLicenses({ withPins: true }),
      ]);
      console.log('[PROFILE] getClientConfig:', clientConfig);
      console.log('[PROFILE] getStreamingLicenses:', licensesResponse);

      if (clientConfig?.profiles && Array.isArray(clientConfig.profiles)) {
        const profilesWithImages = clientConfig.profiles.map(profile => {
          const imageUrl = getImageById(profile.imageId);
          return {
            id: profile.id,
            name: profile.name,
            imageId: profile.imageId,
            imageUrl: imageUrl,
            active: profile.active,
            activeInThisSession: profile.activeInThisSession,
            pin: profile.pin,
            sn: profile.sn,
            ...profile
          };
        });
        setProfiles(profilesWithImages);
      } else {
        setProfiles([]);
      }

      const licensesList = Array.isArray(licensesResponse)
        ? licensesResponse
        : (licensesResponse?.licenses || licensesResponse?.data || []);
      const getCardKey = (card) => card?.KEY ?? card?.key ?? card?.licenseKey ?? card?.Key ?? '';
      const validSmartCards = (Array.isArray(licensesList) ? licensesList : []).filter((card) => {
        const key = getCardKey(card);
        if (!key) return false;
        const products = card?.products;
        if (products !== undefined && products !== null) {
          return typeof products === 'string' && products.trim() !== '';
        }
        return true;
      });
      setSmartCards(validSmartCards);
    } catch (err) {
      console.error('[PROFILE] Error al cargar perfiles o licencias:', err);
      setProfiles([]);
      setSmartCards([]);
      setError(err?.errorInfo?.userMessage || err?.message || t('profile.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Establecer focus inicial en TV
  useEffect(() => {
    if (isTV && (profiles.length > 0 || smartCards.length > 0)) {
      const timer = setTimeout(() => {
        const firstProfile = document.getElementById('profile-0');
        if (firstProfile) firstProfile.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, profiles.length, smartCards.length]);

  const handleProfileSelect = async (profile) => {
    if (isActivating) return;
    setSelectedProfile(profile);
    setProfileMessage(null);
    setError(null);
    setIsActivating(true);
    console.log('[PROFILE] Perfil seleccionado:', profile);
    try {
      const pin = profile.pin != null && profile.pin !== undefined ? String(profile.pin) : '';
      await panaccessService.setActiveProfile({
        profileId: profile.id,
        activate: true,
        deviceName: 'Web',
        failIfInUse: false,
        pin,
      });
      // Ingreso directo: no mostrar modal de bienvenida en éxito.
      navigate('/home/inicio', { replace: true });
    } catch (err) {
      console.error('[PROFILE] Error al activar perfil:', err);
      const message = err?.errorInfo?.userMessage || err?.message || 'Error al activar el perfil.';
      setProfileMessage({ type: 'error', text: message });
    } finally {
      setIsActivating(false);
    }
  };

  const handleAddProfile = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    fetchProfiles();
  };

  const handleDeleteSuccess = () => {
    setProfileToDelete(null);
    fetchProfiles();
  };

  // No mostrar contenido mientras se redirige a /smartcard (marca sin perfiles)
  if (currentBrand && !profilesFeatureEnabled) {
    return null;
  }

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div 
      className="profile-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
      {showCreateModal && (
        <CreateProfileModal
          smartCards={smartCards}
          profiles={profiles}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
      {profileToDelete && (
        <DeleteProfileModal
          profile={profileToDelete}
          onClose={() => setProfileToDelete(null)}
          onSuccess={handleDeleteSuccess}
        />
      )}
      {profileMessage?.type === 'error' && (
        <MessageModal
          type={profileMessage.type}
          message={profileMessage.text}
          onClose={() => {
            setProfileMessage(null);
          }}
        />
      )}

      <div className="profile-overlay"></div>
      
      <div className="profile-container">
        {/* Header */}
        <header className="profile-header">
          {currentBrand?.assets?.logo && (
            <img 
              src={currentBrand.assets.logo} 
              alt={appName} 
              className="profile-logo"
            />
          )}
          <h1 className="profile-title">{t('profile.whoIsWatching')}</h1>
        </header>

        {/* Mensaje de error (carga de perfiles) */}
        {error && (
          <div className="profile-error">
            <p className="profile-error-text">{error}</p>
          </div>
        )}

        {/* Grid de perfiles */}
        {isLoading ? (
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <p>{t('profile.loadingProfiles')}</p>
          </div>
        ) : (
          <div className={`profiles-grid ${isActivating ? 'profiles-grid-disabled' : ''}`}>
            {profiles.length > 0 || smartCards.length > 0 ? (
              <>
                {profiles.map((profile, index) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    index={index}
                    onSelect={() => handleProfileSelect(profile)}
                    onDelete={() => setProfileToDelete(profile)}
                    isSelected={selectedProfile?.id === profile.id}
                    disabled={isActivating}
                  />
                ))}
                {profiles.length < smartCards.length && (
                  <AddProfileCard
                    index={profiles.length}
                    onAdd={handleAddProfile}
                  />
                )}
              </>
            ) : (
              <div className="profile-empty">
                <p>{t('profile.noProfiles')}</p>
              </div>
            )}
          </div>
        )}

        <footer className="profile-footer">
          <FocusableButton
            className="profile-back-button"
            onClick={handleBack}
          >
            {t('common.backLogout')}
          </FocusableButton>
        </footer>
      </div>
    </div>
  );
}

/**
 * Componente de tarjeta de perfil
 */
function ProfileCard({ profile, index, onSelect, onDelete, isSelected, disabled = false }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();

  const handleClick = () => {
    if (disabled) return;
    if (!isTV) onSelect();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onDelete?.(profile);
  };

  return (
    <div
      className={`profile-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div
        id={`profile-${index}`}
        className="profile-card-select"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('profile.profileAria', { name: profile.name })}
      >
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {profile.imageUrl ? (
              <img 
                src={profile.imageUrl} 
                alt={profile.name}
                className="profile-avatar-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            {!profile.imageUrl && (
              <span className="profile-avatar-fallback">👤</span>
            )}
          </div>
          {isSelected && (
            <div className="profile-selected-indicator">
              <span className="check-icon" aria-hidden="true">
                <AppIcon name="done" size={18} />
              </span>
            </div>
          )}
        </div>
        <div className="profile-name">{profile.name}</div>
      </div>
      {onDelete && (
        <button
          type="button"
          className="profile-card-delete"
          onClick={handleDeleteClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onDelete(profile);
            }
          }}
          tabIndex={disabled ? -1 : 0}
          aria-label={t('profile.deleteProfileAria', { name: profile.name })}
        >
          {t('profile.deleteConfirm')}
        </button>
      )}
    </div>
  );
}

/**
 * Componente de tarjeta para agregar perfil
 */
function AddProfileCard({ onAdd }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();

  const handleClick = () => {
    if (!isTV) {
      onAdd();
    }
  };

  const handleKeyDown = (e) => {
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onAdd();
    }
  };

  return (
    <div
      className="profile-card profile-card-add"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={t('profile.addProfileAria')}
    >
      <div className="profile-avatar-wrapper">
        <div className="profile-avatar profile-avatar-add">
          <span className="add-icon">+</span>
        </div>
      </div>
      <div className="profile-name">{t('profile.addProfile')}</div>
    </div>
  );
}

export default ProfilePage;
