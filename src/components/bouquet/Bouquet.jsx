/**
 * Componente Bouquet: obtiene y muestra la lista de bouquets disponibles.
 * Se activa después de seleccionar un perfil o una tarjeta (licencia).
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevice } from '../../contexts/DeviceContext';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';
import * as SpatialNavigation from '@noriginmedia/norigin-spatial-navigation';
import panaccessService from '../../services/panaccessService';

/**
 * Normaliza la respuesta de getBouquets a un array de bouquets.
 * @param {*} response - Respuesta del API (array u objeto con lista)
 * @returns {Array} Lista de bouquets
 */
function normalizeBouquets(response) {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const keys = Object.keys(response).filter((k) => Array.isArray(response[k]));
    if (keys.length > 0) return response[keys[0]];
    if (response.bouquets && Array.isArray(response.bouquets)) return response.bouquets;
    if (response.data && Array.isArray(response.data)) return response.data;
  }
  return [];
}

export function Bouquet() {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const [bouquets, setBouquets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBouquets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await panaccessService.getBouquets({ enableRetry: false });
      const list = normalizeBouquets(response);
      setBouquets(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('[Bouquet] Error al obtener bouquets:', err);
      setBouquets([]);
      setError(err?.errorInfo?.userMessage || err?.message || t('bouquet.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBouquets();
  }, [fetchBouquets]);

  useEffect(() => {
    if (isTV && bouquets.length > 0) {
      const timer = setTimeout(() => {
        const setFocus = SpatialNavigation.setFocus || SpatialNavigation.focus || SpatialNavigation.default?.setFocus;
        if (setFocus && typeof setFocus === 'function') {
          setFocus('bouquet-0');
        } else {
          const el = document.querySelector('[data-focus-key="bouquet-0"]');
          if (el) el.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isTV, bouquets.length]);

  if (isLoading) {
    return (
      <div className="bouquet-loading">
        <div className="loading-spinner" />
        <p className="bouquet-loading-text">{t('bouquet.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bouquet-error">
        <p className="bouquet-error-text">{error}</p>
      </div>
    );
  }

  if (bouquets.length === 0) {
    return (
      <div className="bouquet-empty">
        <p className="bouquet-empty-text">{t('bouquet.noBouquets')}</p>
      </div>
    );
  }

  return (
    <div className="bouquet-grid">
      {bouquets.map((bouquet, index) => (
        <BouquetCard key={bouquet.id ?? index} bouquet={bouquet} index={index} />
      ))}
    </div>
  );
}

function BouquetCard({ bouquet, index }) {
  const { t } = useTranslation();
  const { isTV } = useDevice();
  const name = bouquet.name ?? bouquet.title ?? bouquet.Name ?? bouquet.Title ?? `Bouquet ${index + 1}`;

  const { ref, focused } = useSpatialNavigation({
    focusKey: `bouquet-${index}`,
    isFocusable: true,
  });

  const handleClick = () => {
    if (!isTV) {
      // TODO: acción al seleccionar bouquet (ej. navegar a canales del bouquet)
    }
  };

  const handleKeyDown = (e) => {
    if (!isTV && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      ref={ref}
      className={`bouquet-card ${focused ? 'focused' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isTV ? -1 : 0}
      aria-label={t('bouquet.bouquetAria', { name })}
      data-focus-key={`bouquet-${index}`}
    >
      <div className="bouquet-card-inner">
        <span className="bouquet-card-name">{name}</span>
      </div>
    </div>
  );
}

export default Bouquet;
