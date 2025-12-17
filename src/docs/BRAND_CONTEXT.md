# Brand Context - Guía de Uso

## 📋 Resumen

El `BrandContext` centraliza la configuración del brand activo y proporciona helpers para acceder a imágenes, configuraciones y features.

## 🚀 Ventajas

1. **Estado compartido**: No necesitas pasar props por toda la app
2. **Reactivo**: Cambios de brand se propagan automáticamente
3. **Helpers útiles**: Funciones para imágenes, configs y features
4. **Cambio dinámico**: Cambiar brand sin recargar página

## 📖 Uso Básico

### En cualquier componente:

```jsx
import { useBrand } from '../contexts/BrandContext';

function MyComponent() {
  const { currentBrand, getImage, isFeatureEnabled } = useBrand();
  
  return (
    <div>
      <img src={getImage('logo.png')} alt={currentBrand.appName} />
      {isFeatureEnabled('miniPlayer') && <MiniPlayer />}
    </div>
  );
}
```

## 🔧 API del Context

### Estado
- `currentBrand`: Configuración completa del brand actual
- `isLoading`: Si está cargando la configuración
- `error`: Error si hay problema cargando

### Funciones
- `getImage(imageName)`: Obtiene ruta de imagen del brand
- `getConfig(key, fallback)`: Obtiene valor de configuración
- `getUIConfig(key, fallback)`: Obtiene valor de UI config
- `isFeatureEnabled(featureName)`: Verifica si feature está habilitada
- `changeBrand(brandId, reload)`: Cambia el brand activo
- `loadBrandConfig(brandId)`: Recarga configuración

### Getters (acceso directo)
- `token`: Token de API
- `drm`: URL del DRM
- `appName`: Nombre de la app
- `brand`: ID del brand
- `splashDuration`: Duración del splash
- `splashAnimado`: Si el splash es animado

## 🔄 Migración desde `getActiveBrandConfig()`

### Antes:
```jsx
import { getActiveBrandConfig } from '../config/brandConfig';

function MyComponent() {
  const brandConfig = getActiveBrandConfig();
  
  return (
    <div>
      <img src={brandConfig.assets.logo} />
      <p>{brandConfig.appName}</p>
    </div>
  );
}
```

### Después:
```jsx
import { useBrand } from '../contexts/BrandContext';

function MyComponent() {
  const { currentBrand, getImage } = useBrand();
  
  return (
    <div>
      <img src={getImage('logo.png')} />
      <p>{currentBrand.appName}</p>
    </div>
  );
}
```

## 📝 Ejemplos Completos

### Obtener imagen con fallback:
```jsx
const { getImage } = useBrand();
<img src={getImage('background.png')} onError={(e) => {
  e.target.src = getImage('placeholder.png');
}} />
```

### Verificar feature:
```jsx
const { isFeatureEnabled } = useBrand();

{isFeatureEnabled('miniPlayer') && (
  <button onClick={openMiniPlayer}>Mini Player</button>
)}
```

### Obtener configuración:
```jsx
const { getUIConfig, getConfig } = useBrand();

const primaryColor = getUIConfig('primaryColor', '#000');
const maxProfiles = getConfig('limits.maxProfiles', 5);
```

### Cambiar brand dinámicamente:
```jsx
const { changeBrand } = useBrand();

<button onClick={() => changeBrand('intv', false)}>
  Cambiar a inTV
</button>
```

## ⚠️ Notas Importantes

1. **Siempre usa `useBrand()` dentro de componentes**, no en funciones utilitarias
2. **El Context se inicializa automáticamente** al cargar la app
3. **Los cambios de brand en URL se detectan automáticamente**
4. **Las imágenes se cargan desde `/public/{brand}/`**

## 🎯 Mejoras vs Proyecto Original

1. ✅ Integrado con `panaccessService`
2. ✅ Aplica tema automáticamente
3. ✅ Cambia favicon automáticamente
4. ✅ Soporte para `splashDuration` y `splashAnimado` desde `ui` o raíz
5. ✅ Mejor manejo de rutas con `BASE_URL` de Vite

