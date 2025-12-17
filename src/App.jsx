import { useState, useEffect } from 'react'
import { getActiveBrandConfig } from './config/brandConfig'
import './App.css'

function App() {
  const [brandConfig, setBrandConfig] = useState(null)
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    const config = getActiveBrandConfig()
    setBrandConfig(config)
    document.title = config?.appName || 'OTT App'
    
    // Cambiar favicon dinámicamente
    const favicon = document.querySelector('link[rel="icon"]')
    if (favicon && config?.assets?.favicon) {
      favicon.href = config.assets.favicon
    }
  }, [])

  if (!brandConfig) {
    return <div>Cargando configuración...</div>
  }

  return (
    <div className="app">
      <header>
        {/* Logo dinámico */}
        {!logoError && (
          <img 
            src={brandConfig.assets.logo} 
            alt={`${brandConfig.appName} logo`}
            className="brand-logo"
            onError={() => setLogoError(true)}
          />
        )}
        
        <h1>{brandConfig.appName}</h1>
        <p>Versión: {brandConfig.version || 'N/A'}</p>
      </header>
      
      <section className="brand-info">
        <h2>Configuración Activa</h2>
        <ul>
          <li><strong>Brand:</strong> {brandConfig.brand}</li>
          <li><strong>DRM:</strong> {brandConfig.drm}</li>
          <li><strong>Logo Position:</strong> {brandConfig.logoPositionHome}</li>
          <li><strong>Show Time:</strong> {brandConfig.showTime ? 'Sí' : 'No'}</li>
          <li><strong>EPG Color:</strong> 
            <span style={{ 
              display: 'inline-block', 
              width: '20px', 
              height: '20px', 
              backgroundColor: brandConfig.epgLineColorTime,
              marginLeft: '10px',
              verticalAlign: 'middle'
            }} />
          </li>
          {brandConfig.developedBy && (
            <li><strong>Desarrollado por:</strong> {brandConfig.developedBy}</li>
          )}
        </ul>

        <div className="assets-info">
          <h3>Rutas de Assets</h3>
          <code>{brandConfig.assets.logo}</code>
          <p>Coloca tus imágenes en: <strong>/public/{brandConfig.brand}/</strong></p>
        </div>
      </section>

      <footer>
        <p>Cambia de cliente agregando ?brand=nombre en la URL</p>
        <p>Ejemplo: ?brand=bromteck, ?brand=gigmax, ?brand=intv</p>
      </footer>
    </div>
  )
}

export default App
