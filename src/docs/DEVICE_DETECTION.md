# 🔍 Detección de Dispositivo - Guía Completa

## 🎯 Resumen

Sistema de detección automática de dispositivo (TV vs PC) que permite adaptar la experiencia de usuario según el tipo de dispositivo.

## 📋 Características

- ✅ Detección automática basada en múltiples señales
- ✅ Soporte para override manual (URL parameter)
- ✅ Context API para acceso global
- ✅ Hooks simplificados para uso rápido
- ✅ Clases CSS automáticas en el root

---

## 🔧 Uso Básico

### Hook `useDevice`

```jsx
import { useDevice } from '../contexts/DeviceContext';

function MyComponent() {
  const { isTV, isPC, deviceType } = useDevice();
  
  return (
    <div>
      {isTV && <p>Modo TV activado</p>}
      {isPC && <p>Modo PC activado</p>}
    </div>
  );
}
```

### Hook `useIsTV` / `useIsPC` (simplificado)

```jsx
import { useIsTV } from '../hooks/useDeviceDetection';

function MyComponent() {
  const isTV = useIsTV();
  
  return isTV ? <TVLayout /> : <PCLayout />;
}
```

### Hook `useDeviceDetection` (completo)

```jsx
import { useDeviceDetection } from '../hooks/useDeviceDetection';

function MyComponent() {
  const deviceInfo = useDeviceDetection();
  
  console.log(deviceInfo);
  // {
  //   isTV: true,
  //   isPC: false,
  //   deviceType: 'tv',
  //   detectionMethod: 'user-agent',
  //   userAgent: '...',
  //   hasPointer: false,
  //   hasTouch: false,
  //   screenWidth: 3840,
  //   screenHeight: 2160,
  //   tvScore: 3
  // }
}
```

---

## 🎨 Clases CSS Automáticas

El sistema agrega automáticamente clases al `<html>`:

```html
<!-- En TV -->
<html class="device-tv" data-device="tv">

<!-- En PC -->
<html class="device-pc" data-device="pc">
```

### Uso en SCSS

```scss
// Estilos específicos para TV
.device-tv {
  .my-component {
    // Estilos para TV
  }
}

// Estilos específicos para PC
.device-pc {
  .my-component {
    // Estilos para PC
  }
}

// O usando atributo
[data-device="tv"] {
  .my-component {
    // Estilos para TV
  }
}
```

---

## 🔍 Métodos de Detección

El sistema usa múltiples señales con un sistema de puntuación:

### Señales Detectadas

1. **User-Agent** (peso: 3)
   - Detecta: `smart-tv`, `tizen`, `webos`, `netcast`
   - Compatible con: LG webOS, Samsung Tizen

2. **Pointer Media Query** (peso: 2)
   - Detecta: `(pointer: none)` o `(pointer: coarse)`
   - TVs generalmente no tienen mouse

3. **Platform** (peso: 2)
   - Detecta: `navigator.platform` con "tv", "tizen", "webos"

4. **Vendor + Resolución** (peso: 1)
   - Detecta: LG/Samsung + resolución alta

5. **Resolución + No Pointer** (peso: 1)
   - Detecta: 4K+ sin pointer

6. **Aspect Ratio** (peso: 1)
   - Detecta: 16:9 + sin pointer + alta resolución

### Decisión Final

- **Score >= 2**: Dispositivo es TV
- **Score < 2**: Dispositivo es PC

---

## 🧪 Testing y Override Manual

### Override desde URL

Para forzar un tipo de dispositivo (útil para testing):

```
http://localhost:3000?device=tv   // Fuerza modo TV
http://localhost:3000?device=pc   // Fuerza modo PC
```

**Nota**: El override desde URL se guarda automáticamente en `localStorage` y persiste entre sesiones.

### Persistencia en localStorage

El dispositivo se guarda automáticamente en `localStorage` con la clave `device`:
- Si usas `?device=tv` o `?device=pc`, se guarda y persiste
- Si no hay override, se guarda el resultado de la detección automática
- La próxima vez que cargues la app, usará el valor guardado (si no hay override en URL)

### Limpiar Persistencia

Para volver a la detección automática:

```javascript
localStorage.removeItem('device');
```

### Ejemplo de Uso en Desarrollo

```jsx
function MyComponent() {
  const { isTV, detectionMethod } = useDevice();
  
  // Mostrar método de detección en desarrollo
  if (import.meta.env.DEV) {
    console.log('Dispositivo detectado:', isTV ? 'TV' : 'PC');
    console.log('Método:', detectionMethod);
  }
  
  return <div>...</div>;
}
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Renderizado Condicional

```jsx
import { useDevice } from '../contexts/DeviceContext';

function Navigation() {
  const { isTV } = useDevice();
  
  return (
    <nav>
      {isTV ? (
        <TVNavigation /> // Navegación con flechas
      ) : (
        <PCNavigation /> // Navegación con mouse
      )}
    </nav>
  );
}
```

### Ejemplo 2: Estilos Condicionales

```jsx
import { useDevice } from '../contexts/DeviceContext';

function Button({ children }) {
  const { isTV } = useDevice();
  
  return (
    <button 
      className={`btn ${isTV ? 'btn-tv' : 'btn-pc'}`}
      style={{
        padding: isTV ? '20px 40px' : '10px 20px',
        fontSize: isTV ? '18px' : '14px'
      }}
    >
      {children}
    </button>
  );
}
```

### Ejemplo 3: Event Handlers Diferentes

```jsx
import { useDevice } from '../contexts/DeviceContext';

function Card({ onClick }) {
  const { isTV } = useDevice();
  
  const handleClick = () => {
    if (isTV) {
      // Lógica para TV (Enter desde control remoto)
      onClick();
    } else {
      // Lógica para PC (click de mouse)
      onClick();
    }
  };
  
  return (
    <div 
      onClick={!isTV ? handleClick : undefined}
      onKeyDown={isTV ? (e) => {
        if (e.key === 'Enter') handleClick();
      } : undefined}
      tabIndex={isTV ? 0 : undefined}
    >
      Contenido
    </div>
  );
}
```

### Ejemplo 4: Componente con Lógica Híbrida

```jsx
import { useDevice } from '../contexts/DeviceContext';

function LoginForm() {
  const { isTV, isPC } = useDevice();
  
  return (
    <form>
      <input 
        type="text"
        // En TV: navegación con flechas
        // En PC: navegación normal
      />
      
      {isTV && (
        <div className="tv-keyboard-hint">
          Usa las flechas para navegar
        </div>
      )}
      
      {isPC && (
        <div className="pc-mouse-hint">
          Haz click para continuar
        </div>
      )}
    </form>
  );
}
```

---

## 🐛 Debugging

### Ver Información del Dispositivo

```jsx
import { useDeviceDetection } from '../hooks/useDeviceDetection';

function DebugPanel() {
  const deviceInfo = useDeviceDetection();
  
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, background: 'black', color: 'white', padding: '10px' }}>
      <pre>{JSON.stringify(deviceInfo, null, 2)}</pre>
    </div>
  );
}
```

### Console Logs

El hook no hace logs automáticos, pero puedes agregarlos:

```jsx
useEffect(() => {
  console.log('[DeviceDetection]', {
    isTV: deviceInfo.isTV,
    method: deviceInfo.detectionMethod,
    score: deviceInfo.tvScore
  });
}, [deviceInfo]);
```

---

## ✅ Checklist de Implementación

- [x] Hook `useDeviceDetection` creado
- [x] Context `DeviceContext` creado
- [x] Provider integrado en `App.jsx`
- [x] Clases CSS automáticas
- [x] Override manual desde URL
- [x] Documentación completa

---

## 🔜 Próximos Pasos

1. **Integrar react-tv-space-navigation** (solo en TV)
2. **Adaptar LoginPage** para navegación TV
3. **Crear componentes focusables** para TV
4. **Optimizar estilos** según dispositivo

---

## 📚 Referencias

- [Pointer Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer)
- [User-Agent Detection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent)
- [React Context API](https://react.dev/reference/react/createContext)

