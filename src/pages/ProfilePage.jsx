/**
 * Página de Perfiles de Usuario
 * Diseño moderno tipo OTT (Netflix, Disney+, HBO Max)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import { useDevice } from '../contexts/DeviceContext';
import { useSpatialNavigation } from '../hooks/navigation/useSpatialNavigation';
import panaccessService from '../services/panaccessService';
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
  const { currentBrand, appName, getImage } = useBrand();
  const { isTV } = useDevice();
  
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileMessage, setProfileMessage] = useState(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleBack = () => {
    panaccessService.logout();
    localStorage.removeItem('sessionId');
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    navigate('/login');
  };

  console.log(`🖥️ [PROFILE] Modo: ${isTV ? 'TV' : 'PC'}`);

  // Llamar a getClientConfig al montar el componente
  useEffect(() => {
    const fetchClientConfig = async () => {
      try {
        setIsLoading(true);
        console.log('[PROFILE] Llamando a getClientConfig...');
        const clientConfig = await panaccessService.callAuthenticatedApi('getClientConfig', {}, { enableRetry: false });
        console.log('[PROFILE] Respuesta de getClientConfig:', clientConfig);
        
        // Obtener perfiles de clientConfig
        setError(null);
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
              // Mantener todos los datos originales del perfil
              ...profile
            };
          });
          
          console.log('[PROFILE] Perfiles procesados:', profilesWithImages);
          setProfiles(profilesWithImages);
        } else {
          console.warn('[PROFILE] No se encontraron perfiles en clientConfig');
          setProfiles([]);
        }
      } catch (err) {
        console.error('[PROFILE] Error al obtener getClientConfig:', err);
        setProfiles([]);
        setError(err?.errorInfo?.userMessage || err?.message || t('profile.errorLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientConfig();
  }, []);

  // Establecer focus inicial en TV
  useEffect(() => {
    if (isTV && profiles.length > 0) {
      const timer = setTimeout(() => {
        const firstProfile = document.querySelector('[data-focus-key="profile-0"]');
        if (firstProfile) {
          firstProfile.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, profiles.length]);

  const handleProfileSelect = async (profile) => {
    if (isActivating) return;
    setSelectedProfile(profile);
    setProfileMessage(null);
    setError(null);
    setIsActivating(true);
    console.log('[PROFILE] Perfil seleccionado:', profile);
    try {
      const pin = profile.pin != null && profile.pin !== undefined ? String(profile.pin) : '';
      await panaccessService.callAuthenticatedApi('setActiveProfile', {
        profileId: profile.id,
        activate: true,
        deviceName: 'Web',
        failIfInUse: false,
        pin,
      });
      setProfileMessage({ type: 'success', text: `Perfil "${profile.name}" activado correctamente.` });
    } catch (err) {
      console.error('[PROFILE] Error al activar perfil:', err);
      const message = err?.errorInfo?.userMessage || err?.message || 'Error al activar el perfil.';
      setProfileMessage({ type: 'error', text: message });
    } finally {
      setIsActivating(false);
    }
  };

  const handleAddProfile = () => {
    console.log('[PROFILE] Agregar nuevo perfil');
    // Aquí iría la lógica para agregar un nuevo perfil
    // Por ahora, solo mostramos un mensaje
    alert(t('profile.addProfileComingSoon'));
  };

  const backgroundPath = currentBrand?.assets?.background || getImage('background.png');

  return (
    <div 
      className="profile-page"
      style={backgroundPath ? { backgroundImage: `url(${backgroundPath})` } : {}}
    >
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

        {/* Mensaje al activar perfil (éxito o error) */}
        {profileMessage && (
          <div className={profileMessage.type === 'success' ? 'profile-message profile-message-success' : 'profile-message profile-message-error'}>
            <p className="profile-message-text">{profileMessage.text}</p>
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
            {profiles.length > 0 ? (
              <>
                {profiles.map((profile, index) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    index={index}
                    onSelect={() => handleProfileSelect(profile)}
                    isSelected={selectedProfile?.id === profile.id}
                    disabled={isActivating}
                  />
                ))}
                
                <AddProfileCard
                  index={profiles.length}
                  onAdd={handleAddProfile}
                />
              </>
            ) : (
              <div className="profile-empty">
                <p>{t('profile.noProfiles')}</p>
              </div>
            )}
          </div>
        )}

        <footer className="profile-footer">
          <button
            className="profile-back-button"
            onClick={handleBack}
            data-focus-key="profile-back"
          >
            {t('common.backLogout')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Componente de tarjeta de perfil
 */
function ProfileCard({ profile, index, onSelect, isSelected, disabled = false }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: disabled ? undefined : onSelect,
    focusKey: `profile-${index}`,
    isFocusable: !disabled,
  });

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

  return (
    <div
      ref={ref}
      className={`profile-card ${focused ? 'focused' : ''} ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={t('profile.profileAria', { name: profile.name })}
      data-focus-key={`profile-${index}`}
    >
      <div className="profile-avatar-wrapper">
        <div className="profile-avatar">
          {profile.imageUrl ? (
            <img 
              src={profile.imageUrl} 
              alt={profile.name}
              className="profile-avatar-image"
              onError={(e) => {
                // Fallback a emoji si la imagen falla
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
            <span className="check-icon">✓</span>
          </div>
        )}
      </div>
      <div className="profile-name">{profile.name}</div>
    </div>
  );
}

/**
 * Componente de tarjeta para agregar perfil
 */
function AddProfileCard({ index, onAdd }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: onAdd,
    focusKey: `profile-add-${index}`,
  });

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
      ref={ref}
      className={`profile-card profile-card-add ${focused ? 'focused' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={t('profile.addProfileAria')}
      data-focus-key={`profile-add-${index}`}
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
