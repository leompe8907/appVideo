/**
 * Página de Perfiles de Usuario
 * Diseño moderno tipo OTT (Netflix, Disney+, HBO Max)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { currentBrand, appName, getImage } = useBrand();
  const { isTV } = useDevice();
  
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log(`🖥️ [PROFILE] Modo: ${isTV ? 'TV' : 'PC'}`);

  // Llamar a getClientConfig al montar el componente
  useEffect(() => {
    const fetchClientConfig = async () => {
      try {
        setIsLoading(true);
        console.log('[PROFILE] Llamando a getClientConfig...');
        const clientConfig = await panaccessService.callAuthenticatedApi('getClientConfig', {}, { enableRetry: false });
        console.log('[PROFILE] Respuesta de getClientConfig:', clientConfig);
        console.log('[PROFILE] getClientConfig (JSON):', JSON.stringify(clientConfig, null, 2));
        
        // Obtener perfiles de clientConfig
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
      } catch (error) {
        console.error('[PROFILE] Error al obtener getClientConfig:', error);
        setProfiles([]);
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

  const handleProfileSelect = (profile) => {
    setSelectedProfile(profile);
    // Aquí iría la lógica para cargar el perfil seleccionado
    console.log('[PROFILE] Perfil seleccionado:', profile);
    // Por ahora, navegar a home
    setTimeout(() => {
      navigate('/home');
    }, 500);
  };

  const handleAddProfile = () => {
    console.log('[PROFILE] Agregar nuevo perfil');
    // Aquí iría la lógica para agregar un nuevo perfil
    // Por ahora, solo mostramos un mensaje
    alert('Funcionalidad de agregar perfil próximamente');
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
          <h1 className="profile-title">¿Quién está viendo?</h1>
        </header>

        {/* Grid de perfiles */}
        {isLoading ? (
          <div className="profile-loading">
            <div className="loading-spinner"></div>
            <p>Cargando perfiles...</p>
          </div>
        ) : (
          <div className="profiles-grid">
            {profiles.length > 0 ? (
              <>
                {profiles.map((profile, index) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    index={index}
                    onSelect={() => handleProfileSelect(profile)}
                    isSelected={selectedProfile?.id === profile.id}
                  />
                ))}
                
                {/* Tarjeta para agregar perfil */}
                <AddProfileCard
                  index={profiles.length}
                  onAdd={handleAddProfile}
                />
              </>
            ) : (
              <div className="profile-empty">
                <p>No se encontraron perfiles</p>
              </div>
            )}
          </div>
        )}

        {/* Footer con botón de volver */}
        <footer className="profile-footer">
          <button
            className="profile-back-button"
            onClick={() => navigate('/home')}
            data-focus-key="profile-back"
          >
            ← Volver
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Componente de tarjeta de perfil
 */
function ProfileCard({ profile, index, onSelect, isSelected }) {
  const { isTV } = useDevice();
  const { ref, focused } = useSpatialNavigation({
    onEnterPress: onSelect,
    focusKey: `profile-${index}`,
  });

  const handleClick = () => {
    if (!isTV) {
      onSelect();
    }
  };

  const handleKeyDown = (e) => {
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      ref={ref}
      className={`profile-card ${focused ? 'focused' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={`Perfil ${profile.name}`}
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
      aria-label="Agregar nuevo perfil"
      data-focus-key={`profile-add-${index}`}
    >
      <div className="profile-avatar-wrapper">
        <div className="profile-avatar profile-avatar-add">
          <span className="add-icon">+</span>
        </div>
      </div>
      <div className="profile-name">Agregar Perfil</div>
    </div>
  );
}

export default ProfilePage;
