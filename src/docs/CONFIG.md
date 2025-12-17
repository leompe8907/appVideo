# Sistema de Configuración por Cliente

Configuración organizada en 3 secciones principales: **UI**, **Limits**, **Features**.

## 📁 Estructura de Configuración

```js
{
  brand: "intv",
  appName: "inTV Play",
  drm: "...",
  token: "...",
  developedBy: "...",
  version: "2.0.2",
  
  // 🎨 UI: Colores, posiciones, temas
  ui: {
    logoPositionHome: "right",
    showTime: false,
    epgLineColorTime: "#3333FF",
    primaryColor: "#3333FF",
    secondaryColor: "#1a1aaa",
    theme: "light",
    fontFamily: "Roboto, sans-serif",
  },
  
  // ⚙️ Límites: Números, restricciones
  limits: {
    maxProfiles: 7,
    maxDownloads: 20,
    concurrentStreams: 3,
    recordingMaxDuration: 180,
    watchlistMaxItems: 200,
  },
  
  // 🎛️ Features: Banderas booleanas
  features: {
    miniPlayer: true,
    chat: false,
    // ...
  }
}
```

---

## 🎨 Sección UI

**Propiedades de interfaz, colores, posiciones, temas.**

### Propiedades Disponibles

```js
ui: {
  logoPositionHome: "right" | "top" | "left" | "center",
  showTime: boolean,
  epgLineColorTime: string,    // Color hex
  primaryColor: string,         // Color principal
  secondaryColor: string,       // Color secundario
  theme: "light" | "dark",
  fontFamily: string,           // CSS font-family
}
```

### Uso en Código

```jsx
import { getUIConfig, getAllUIConfig, applyTheme } from './utils/config'

// Obtener valor específico
const primaryColor = getUIConfig(brandConfig, 'primaryColor', '#000')
const logoPosition = getUIConfig(brandConfig, 'logoPositionHome')

// Obtener toda la config UI
const uiConfig = getAllUIConfig(brandConfig)

// Aplicar tema automáticamente
applyTheme(brandConfig) // Aplica CSS variables y data-theme

// Usar en JSX
<div style={{ color: getUIConfig(brandConfig, 'primaryColor') }}>
  Texto con color de marca
</div>
```

---

## ⚙️ Sección Limits

**Límites numéricos, restricciones, cuotas.**

### Propiedades Disponibles

```js
limits: {
  maxProfiles: number,           // Perfiles máximos
  maxDownloads: number,          // Descargas simultáneas
  concurrentStreams: number,     // Streams concurrentes
  recordingMaxDuration: number,  // Minutos de grabación
  watchlistMaxItems: number,     // Items en watchlist
}
```

### Uso en Código

```jsx
import { getLimit, getAllLimits } from './utils/config'

// Obtener límite específico
const maxProfiles = getLimit(brandConfig, 'maxProfiles', 5)
const maxDownloads = getLimit(brandConfig, 'maxDownloads', 10)

// Obtener todos los límites
const limits = getAllLimits(brandConfig)

// Validación en componente
function ProfileSelector() {
  const maxProfiles = getLimit(brandConfig, 'maxProfiles', 5)
  
  if (currentProfiles >= maxProfiles) {
    return <p>Límite alcanzado: {maxProfiles} perfiles</p>
  }
  
  return <CreateProfileButton />
}
```

---

## 🎛️ Sección Features

**Banderas booleanas para habilitar/deshabilitar funcionalidades.**

Ver documentación completa en [`FEATURES.md`](./FEATURES.md)

```jsx
import { isFeatureEnabled } from './utils/features'

{isFeatureEnabled(brandConfig, 'miniPlayer') && (
  <MiniPlayer />
)}
```

---

## 💻 Ejemplos Completos

### Ejemplo 1: Player con Config Dinámica

```jsx
import { getUIConfig, getLimit, isFeatureEnabled } from './utils/config'

function VideoPlayer({ brandConfig }) {
  const primaryColor = getUIConfig(brandConfig, 'primaryColor')
  const maxStreams = getLimit(brandConfig, 'concurrentStreams', 2)
  const hasPip = isFeatureEnabled(brandConfig, 'pip')

  return (
    <div className="player" style={{ borderColor: primaryColor }}>
      <video src={videoUrl} />
      
      <Controls>
        {hasPip && <PipButton />}
        <StreamsIndicator max={maxStreams} />
      </Controls>
    </div>
  )
}
```

### Ejemplo 2: Tema Automático

```jsx
import { applyTheme } from './utils/config'

function App() {
  useEffect(() => {
    const config = getActiveBrandConfig()
    applyTheme(config) // Aplica CSS variables
  }, [])

  return (
    <div className="app">
      {/* Los estilos usan var(--primary-color) automáticamente */}
    </div>
  )
}
```

### Ejemplo 3: Validación de Límites

```jsx
import { getLimit } from './utils/config'

function DownloadManager({ brandConfig }) {
  const maxDownloads = getLimit(brandConfig, 'maxDownloads', 10)
  const currentDownloads = downloads.length

  const canDownload = currentDownloads < maxDownloads

  return (
    <div>
      <p>Descargas: {currentDownloads}/{maxDownloads}</p>
      
      {canDownload ? (
        <DownloadButton />
      ) : (
        <p>Límite alcanzado</p>
      )}
    </div>
  )
}
```

---

## ➕ Agregar Nuevas Propiedades

### Agregar Propiedad UI

1. **Editar `src/config/brands.js`** (para TODOS los clientes):

```js
ui: {
  // ... propiedades existentes
  backgroundColor: "#FFFFFF",  // Nueva propiedad
}
```

2. **Usar en componente:**

```jsx
const bgColor = getUIConfig(brandConfig, 'backgroundColor', '#FFF')
```

### Agregar Límite

1. **Editar `src/config/brands.js`**:

```js
limits: {
  // ... límites existentes
  maxFavorites: 50,  // Nuevo límite
}
```

2. **Usar:**

```jsx
const maxFavs = getLimit(brandConfig, 'maxFavorites', 50)
```

---

## 🎯 API Reference

### getUIConfig(brandConfig, key, defaultValue)
Obtiene una propiedad de UI.

### getLimit(brandConfig, key, defaultValue)
Obtiene un límite numérico.

### getAllUIConfig(brandConfig)
Obtiene toda la configuración UI.

### getAllLimits(brandConfig)
Obtiene todos los límites.

### applyTheme(brandConfig)
Aplica el tema al documento (CSS variables).

### useUIConfig(brandConfig, key, defaultValue)
Hook React para obtener config UI.

### useLimit(brandConfig, key, defaultValue)
Hook React para obtener límite.

---

## 📝 Notas

- **UI**: Propiedades visuales (strings, colores)
- **Limits**: Valores numéricos, restricciones
- **Features**: Solo booleanos (true/false)
- Siempre proporciona valores por defecto
- Las CSS variables se aplican automáticamente con `applyTheme()`

