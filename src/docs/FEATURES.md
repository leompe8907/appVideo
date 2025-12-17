# Sistema de Features por Cliente

Sistema de banderas (feature flags) para habilitar/deshabilitar funcionalidades según el cliente.

## 📋 Features Disponibles

```js
features: {
  miniPlayer: false,        // Reproductor minimizable
  chat: false,              // Chat en vivo
  recording: false,         // Grabación de contenido
  pip: false,               // Picture in Picture
  chromecast: false,        // Soporte Chromecast
  downloads: false,         // Descargas offline
  profiles: false,          // Perfiles de usuario
  parentalControl: false,   // Control parental
  watchlist: true,          // Lista de favoritos
  recommendations: true,    // Recomendaciones
}
```

## 🔧 Configurar Features por Cliente

**Editar `src/config/brands.js`:**

```js
{
  brand: "intv",
  appName: "inTV Play",
  // ... otras configs
  features: {
    miniPlayer: true,   // ✅ Habilitado
    chat: false,        // ❌ Deshabilitado
    recording: true,
  }
}
```

## 💻 Uso en Componentes

### Opción 1: Verificación Directa

```jsx
import { isFeatureEnabled } from './utils/features'
import { getActiveBrandConfig } from './config/brandConfig'

function VideoPlayer() {
  const brandConfig = getActiveBrandConfig()

  return (
    <div>
      {isFeatureEnabled(brandConfig, 'miniPlayer') && (
        <MiniPlayerButton />
      )}
      
      {isFeatureEnabled(brandConfig, 'chromecast') && (
        <ChromecastButton />
      )}
    </div>
  )
}
```

### Opción 2: Componente FeatureFlag

```jsx
import { FeatureFlag } from './utils/features'

function VideoPlayer() {
  const brandConfig = getActiveBrandConfig()

  return (
    <FeatureFlag 
      brandConfig={brandConfig} 
      feature="miniPlayer"
      fallback={<p>Mini Player no disponible</p>}
    >
      <MiniPlayer />
    </FeatureFlag>
  )
}
```

### Opción 3: Hook Personalizado

```jsx
import { useFeature } from './utils/features'

function VideoPlayer() {
  const brandConfig = getActiveBrandConfig()
  const hasMiniPlayer = useFeature(brandConfig, 'miniPlayer')

  if (hasMiniPlayer) {
    return <MiniPlayer />
  }

  return <StandardPlayer />
}
```

## ➕ Agregar Nueva Feature

1. **Agregar a todos los clientes** en `src/config/brands.js`:

```js
features: {
  // ... features existentes
  newFeature: false,  // Agregar a TODOS los clientes
}
```

2. **Usar en componente:**

```jsx
{isFeatureEnabled(brandConfig, 'newFeature') && (
  <NewFeatureComponent />
)}
```

## 🎯 Funciones Disponibles

```js
// Verificar si feature está habilitada
isFeatureEnabled(brandConfig, 'miniPlayer') // true/false

// Obtener valor de feature (para features no booleanas)
getFeatureValue(brandConfig, 'maxProfiles', 5)

// Obtener todas las features habilitadas
getEnabledFeatures(brandConfig) // ['miniPlayer', 'chat', ...]

// Hook para React
useFeature(brandConfig, 'miniPlayer') // true/false

// Componente helper
<FeatureFlag brandConfig={config} feature="chat">
  <ChatComponent />
</FeatureFlag>
```

## ⚡ Ejemplos Prácticos

### Menú Dinámico

```jsx
function Menu() {
  const brandConfig = getActiveBrandConfig()

  return (
    <nav>
      <MenuItem to="/home">Inicio</MenuItem>
      <MenuItem to="/live">En Vivo</MenuItem>
      
      {isFeatureEnabled(brandConfig, 'recording') && (
        <MenuItem to="/recordings">Grabaciones</MenuItem>
      )}
      
      {isFeatureEnabled(brandConfig, 'downloads') && (
        <MenuItem to="/downloads">Descargas</MenuItem>
      )}
      
      {isFeatureEnabled(brandConfig, 'profiles') && (
        <MenuItem to="/profiles">Perfiles</MenuItem>
      )}
    </nav>
  )
}
```

### Player con Features Opcionales

```jsx
function Player({ videoUrl }) {
  const brandConfig = getActiveBrandConfig()

  return (
    <div className="player">
      <VideoElement src={videoUrl} />
      
      <Controls>
        <PlayButton />
        <VolumeControl />
        
        {isFeatureEnabled(brandConfig, 'pip') && (
          <PipButton />
        )}
        
        {isFeatureEnabled(brandConfig, 'chromecast') && (
          <ChromecastButton />
        )}
        
        {isFeatureEnabled(brandConfig, 'miniPlayer') && (
          <MinimizeButton />
        )}
      </Controls>
    </div>
  )
}
```

## 🚨 Importante

- **Siempre** agrega nuevas features a TODOS los clientes (aunque sea en `false`)
- Mantén consistencia en los nombres (camelCase)
- Documenta features complejas
- Usa valores por defecto seguros

