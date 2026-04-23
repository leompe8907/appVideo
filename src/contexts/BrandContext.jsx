import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getActiveBrandConfig,
  enrichConfigWithAssets,
  invalidateBrandCache,
} from '../config/brandConfig';
import { getBrandConfig } from '../config/brands';
import { getBrandAsset } from '../utils/assetLoader';
import { applyTheme } from '../utils/config';
import panaccessService from '../services/panaccessService';

const BrandContext = createContext(null);

/**
 * Hook para usar el Brand Context
 * @returns {object} Contexto del brand actual
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand debe usarse dentro de BrandProvider');
  }
  return context;
};

/**
 * Provider del Brand Context
 * Maneja la configuración del brand activo y proporciona helpers
 */
export const BrandProvider = ({ children }) => {
  const { t } = useTranslation();
  const [currentBrand, setCurrentBrand] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Carga la configuración del brand
   * @param {string} brandId - ID del brand a cargar (opcional)
   */
  const loadBrandConfig = (brandId = null) => {
    try {
      let brandConfig;

      if (brandId) {
        // Cargar configuración del brand especificado
        const config = getBrandConfig(brandId);
        if (!config) {
          if (import.meta.env.DEV) {
            console.warn(`[BrandContext] Brand "${brandId}" no encontrado, usando default`);
          }
          brandConfig = getActiveBrandConfig();
        } else {
          brandConfig = enrichConfigWithAssets(config);
        }
      } else {
        // Cargar configuración del brand activo
        brandConfig = getActiveBrandConfig();
      }
      
      if (!brandConfig) {
        setError('No se encontró configuración de brand');
        setIsLoading(false);
        return;
      }

      // Aplicar tema
      applyTheme(brandConfig);
      document.title = `${brandConfig.appName} - Cargando...`;

      // Inicializar servicio Panaccess
      panaccessService.initialize(brandConfig);

      // Cambiar favicon
      const favicon = document.querySelector('link[rel="icon"]');
      if (favicon && brandConfig.assets?.favicon) {
        favicon.href = brandConfig.assets.favicon;
      }

      setCurrentBrand(brandConfig);
      setError(null);
      setIsLoading(false);
      
      // Guardar brand en localStorage para persistencia
      if (brandConfig?.brand) {
        localStorage.setItem('brand', brandConfig.brand);
      }
    } catch (err) {
      console.error('[BrandContext] Error cargando brand config:', err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  /**
   * Cambia el brand actual
   * @param {string} brandId - ID del nuevo brand
   * @param {boolean} reload - Si true, recarga la página (por defecto: false)
   */
  const changeBrand = (brandId, reload = false) => {
    // Guardar brand en localStorage para persistencia
    localStorage.setItem('brand', brandId);
    invalidateBrandCache();

    if (reload) {
      // Recargar la página con el nuevo brand en la URL
      window.location.href = `${window.location.pathname}?brand=${brandId}`;
    } else {
      // Cargar la nueva configuración del brand
      loadBrandConfig(brandId);
    }
  };

  useEffect(() => {
    // Cargar brand inicialmente
    loadBrandConfig();
    
    // Escuchar cambios en popstate (navegación del navegador)
    const handlePopState = () => {
      loadBrandConfig();
    };
    window.addEventListener('popstate', handlePopState);
    
    // También verificar si cambia el localStorage desde otra pestaña
    const handleStorageChange = (e) => {
      if (e.key === 'brand') {
        loadBrandConfig();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  /**
   * Obtiene la ruta de una imagen del brand actual
   * @param {string} imageName - Nombre de la imagen (ej: 'logo.png', 'splash.gif')
   * @returns {string} Ruta de la imagen
   */
  const getImage = (imageName) => {
    if (!currentBrand) {
      return null;
    }
    return currentBrand.assets?.get(imageName) || getBrandAsset(currentBrand.brand, imageName);
  };

  /**
   * Obtiene un valor de configuración del brand actual con fallback
   * @param {string} key - Clave de configuración
   * @param {any} fallback - Valor por defecto si no existe
   * @returns {any} Valor de la configuración o fallback
   */
  const getConfig = (key, fallback = null) => {
    if (!currentBrand) {
      return fallback;
    }
    return currentBrand[key] !== undefined ? currentBrand[key] : fallback;
  };

  /**
   * Obtiene un valor de UI config
   * @param {string} key - Clave de UI config
   * @param {any} fallback - Valor por defecto
   * @returns {any}
   */
  const getUIConfig = (key, fallback = null) => {
    if (!currentBrand) {
      return fallback;
    }
    return currentBrand.ui?.[key] !== undefined ? currentBrand.ui[key] : fallback;
  };

  /**
   * Verifica si una feature está habilitada
   * @param {string} featureName - Nombre de la feature
   * @returns {boolean}
   */
  const isFeatureEnabled = (featureName) => {
    if (!currentBrand) {
      return false;
    }
    return currentBrand.features?.[featureName] === true;
  };

  const value = {
    // Estado
    currentBrand,
    isLoading,
    error,
    
    // Funciones
    getImage,
    getConfig,
    getUIConfig,
    isFeatureEnabled,
    changeBrand,
    loadBrandConfig,
    
    // Helpers directos para valores comunes (getters)
    get token() {
      return getConfig('token', '');
    },
    get drm() {
      return getConfig('drm', '');
    },
    get appName() {
      return getConfig('appName', 'OTT App');
    },
    get brand() {
      return getConfig('brand', '');
    },
    get splashDuration() {
      return getUIConfig('splashDuration') || getConfig('splashDuration', 3000);
    },
    get splashAnimado() {
      return getUIConfig('splashAnimado') || getConfig('splashAnimado', false);
    },
  };

  // Mostrar loading solo si realmente está cargando
  if (isLoading) {
    return (
      <div className="brand-loading" role="status" aria-live="polite" aria-busy="true">
        <div className="brand-loading__spinner" aria-hidden="true" />
        <p className="brand-loading__label">{t('brand.loadingConfig')}</p>
      </div>
    );
  }

  // Mostrar error solo si es crítico (no hay brand)
  if (error && !currentBrand) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>{t('brand.configErrorTitle')}</h2>
        <p>{error}</p>
        <p>{t('brand.configErrorHint')}</p>
      </div>
    );
  }

  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
};

