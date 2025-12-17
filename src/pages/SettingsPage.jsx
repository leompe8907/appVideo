/**
 * Página de Configuración
 */

import { useState } from 'react';
import { getActiveBrandConfig } from '../config/brandConfig';
import { isFeatureEnabled, getEnabledFeatures, FeatureFlag } from '../utils/features';
import { getUIConfig, getLimit, getAllUIConfig, getAllLimits } from '../utils/config';

export function SettingsPage() {
  const [showConfig, setShowConfig] = useState(false);
  const brandConfig = getActiveBrandConfig();
  const enabledFeatures = getEnabledFeatures(brandConfig);
  const uiConfig = getAllUIConfig(brandConfig);
  const limits = getAllLimits(brandConfig);

  return (
    <div className="settings-page">
      <h1>Configuración</h1>

      <section className="settings-section">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2>Información del Sistema</h2>
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className="btn btn-outline-primary"
          >
            {showConfig ? 'Ocultar Detalles' : 'Ver Detalles'}
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <ul className="list-unstyled">
              <li><strong>Brand:</strong> {brandConfig.brand}</li>
              <li><strong>App:</strong> {brandConfig.appName}</li>
              <li><strong>Versión:</strong> {brandConfig.version || 'N/A'}</li>
              <li><strong>DRM:</strong> {brandConfig.drm}</li>
              {brandConfig.developedBy && (
                <li><strong>Desarrollado por:</strong> {brandConfig.developedBy}</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {showConfig && (
        <>
          {/* Configuración UI */}
          <section className="settings-section">
            <h2>🎨 Configuración UI</h2>
            <div className="card">
              <div className="card-body">
                <ul className="list-unstyled">
                  <li><strong>Logo Position:</strong> {uiConfig.logoPositionHome}</li>
                  <li><strong>Show Time:</strong> {uiConfig.showTime ? 'Sí' : 'No'}</li>
                  <li><strong>Theme:</strong> {uiConfig.theme}</li>
                  <li><strong>Font:</strong> {uiConfig.fontFamily}</li>
                  <li>
                    <strong>Primary Color:</strong> 
                    <span style={{ 
                      display: 'inline-block', 
                      width: '30px', 
                      height: '20px', 
                      backgroundColor: uiConfig.primaryColor,
                      marginLeft: '10px',
                      verticalAlign: 'middle',
                      border: '1px solid #ccc'
                    }} />
                    {uiConfig.primaryColor}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Límites */}
          <section className="settings-section">
            <h2>⚙️ Límites y Restricciones</h2>
            <div className="card">
              <div className="card-body">
                <ul className="list-unstyled">
                  <li><strong>Max Profiles:</strong> {limits.maxProfiles}</li>
                  <li><strong>Max Downloads:</strong> {limits.maxDownloads}</li>
                  <li><strong>Concurrent Streams:</strong> {limits.concurrentStreams}</li>
                  <li><strong>Recording Duration:</strong> {limits.recordingMaxDuration} min</li>
                  <li><strong>Watchlist Items:</strong> {limits.watchlistMaxItems}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="settings-section">
            <h2>🎛️ Features Habilitadas</h2>
            <div className="card">
              <div className="card-body">
                <div className="features-grid">
                  {Object.entries(brandConfig.features).map(([name, enabled]) => (
                    <span 
                      key={name} 
                      className={`feature-badge ${enabled ? 'enabled' : 'disabled'}`}
                    >
                      {enabled ? '✓' : '✗'} {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Assets Info */}
          <section className="settings-section">
            <h2>📁 Rutas de Assets</h2>
            <div className="card">
              <div className="card-body">
                <code>{brandConfig.assets.logo}</code>
                <p className="mt-2">Coloca tus imágenes en: <strong>/public/{brandConfig.brand}/</strong></p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default SettingsPage;

