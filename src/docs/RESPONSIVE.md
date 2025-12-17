# 📱 Sistema Responsive - Guía Completa

## 🎯 Resumen

Sistema responsive completo que se ajusta automáticamente a todas las resoluciones sin necesidad de refrescar la aplicación.

## 📐 Resoluciones Soportadas

| Resolución | Breakpoint | Dispositivos |
|------------|------------|--------------|
| **Mobile** | < 768px | Smartphones |
| **Tablet** | 768px - 1023px | Tablets |
| **Desktop** | 1024px - 1279px | Notebooks, Laptops |
| **HD** | 1280px - 1919px | TVs HD (720p) |
| **Full HD** | 1920px - 2559px | TVs Full HD (1080p) - **BASE** |
| **Ultra HD** | 2560px - 3839px | TVs Ultra HD / QHD |
| **4K** | 3840px - 7679px | TVs 4K UHD |
| **8K** | ≥ 7680px | TVs 8K UHD |

## 🔧 Componentes del Sistema

### 1. Hook `useViewport`

Detecta cambios de tamaño en tiempo real:

```jsx
import { useViewport } from '../hooks/useViewport';

function MyComponent() {
  const { width, height, is4K, is8K, scale } = useViewport();
  
  return (
    <div style={{ fontSize: `${16 * scale}px` }}>
      Ancho: {width}px
    </div>
  );
}
```

**Propiedades disponibles:**
- `width`: Ancho actual del viewport
- `height`: Alto actual del viewport
- `isMobile`, `isTablet`, `isDesktop`, `isHD`, `isFullHD`, `isUltraHD`, `is4K`, `is8K`: Booleanos según breakpoint
- `scale`: Factor de escala (base: 1920px = 1.0)

### 2. Breakpoints SCSS

```scss
@include mobile { /* < 768px */ }
@include tablet { /* 768px - 1023px */ }
@include desktop { /* 1024px - 1279px */ }
@include hd { /* 1280px - 1919px */ }
@include fullhd { /* 1920px - 2559px */ }
@include ultrahd { /* 2560px - 3839px */ }
@include 4k { /* 3840px - 7679px */ }
@include 8k { /* ≥ 7680px */ }
```

### 3. Utilidades JavaScript

```js
import { scaleSize, getBreakpoint, pxToVw, getScaleFactor } from '../utils/responsive';

// Escalar tamaño basado en viewport
const scaledSize = scaleSize(100, window.innerWidth); // 100px en Full HD

// Obtener breakpoint actual
const breakpoint = getBreakpoint(); // 'fullhd', '4k', etc.

// Convertir píxeles a viewport width
const vwValue = pxToVw(100); // "5.208vw" (100px de 1920px)

// Factor de escala
const scale = getScaleFactor(); // 2.0 para 4K
```

## 🎨 Uso en Estilos

### Clamp para Tamaños Responsive

```scss
// Tamaño que se ajusta entre mínimo y máximo
font-size: clamp(1rem, 2vw, 2rem);
padding: clamp(1rem, 3vw, 3rem);
max-width: clamp(300px, 22vw, 500px);
```

### Viewport Units (vw, vh)

```scss
// Usar unidades viewport para escalado automático
width: 22vw; // 22% del ancho del viewport
height: 10vh; // 10% del alto del viewport
font-size: 1.2vw; // Escala con el ancho
```

### Mixins Responsive

```scss
.my-component {
  font-size: 1rem;
  
  @include mobile {
    font-size: 0.875rem;
  }
  
  @include 4k {
    font-size: 1.5rem;
  }
  
  @include 8k {
    font-size: 2rem;
  }
}
```

## 📏 Estrategia de Escalado

### Base: Full HD (1920x1080)

Todos los tamaños se calculan desde Full HD como base:

```scss
// Ejemplo: Logo de 300px en Full HD
.brand-logo {
  max-width: clamp(200px, 15vw, 400px);
  // 200px mínimo, 15vw preferido, 400px máximo
}
```

### Escalado Automático

El sistema usa:
1. **CSS Clamp**: Para límites mínimos y máximos
2. **Viewport Units (vw/vh)**: Para escalado proporcional
3. **Media Queries**: Para ajustes específicos por breakpoint
4. **JavaScript Hook**: Para detección en tiempo real

## 🔄 Actualización Automática

El hook `useViewport` escucha:
- `resize`: Cambios de tamaño de ventana
- `orientationchange`: Cambios de orientación (móvil)

**No requiere refrescar** - Los cambios se aplican automáticamente.

## 📝 Ejemplos de Uso

### Ejemplo 1: Tamaño de Fuente Responsive

```scss
.title {
  font-size: clamp(1.5rem, 3vw, 3rem);
  // Mínimo: 1.5rem, Preferido: 3vw, Máximo: 3rem
}
```

### Ejemplo 2: Padding Responsive

```scss
.container {
  padding: clamp(1rem, 2vw, 3rem);
  // Se ajusta automáticamente según el viewport
}
```

### Ejemplo 3: Componente con Lógica JavaScript

```jsx
import { useViewport } from '../hooks/useViewport';

function ResponsiveComponent() {
  const { width, is4K } = useViewport();
  
  const itemCount = is4K ? 8 : 4; // Más items en 4K
  
  return (
    <div style={{ 
      fontSize: `${16 * (width / 1920)}px` 
    }}>
      {/* Contenido */}
    </div>
  );
}
```

## 🎯 Mejores Prácticas

1. **Usa `clamp()` para tamaños**: Evita valores fijos en píxeles
2. **Viewport units para escalado**: `vw` y `vh` se ajustan automáticamente
3. **Breakpoints para cambios grandes**: Usa media queries para cambios significativos
4. **Base Full HD**: Calcula todo desde 1920px como referencia
5. **Prueba en diferentes resoluciones**: Verifica que todo se vea bien

## 🚀 Clases CSS Útiles

El sistema agrega clases automáticas al `<html>` según el breakpoint:
- `.mobile`
- `.tablet`
- `.desktop`
- `.hd`
- `.fullhd`
- `.ultrahd`
- `.4k`
- `.8k`

Úsalas para estilos específicos:

```scss
.my-element {
  .4k & {
    font-size: 1.5rem;
  }
  
  .8k & {
    font-size: 2rem;
  }
}
```

## 📊 Tabla de Conversión

| Tamaño Full HD | 4K (2x) | 8K (4x) |
|----------------|----------|---------|
| 16px | 32px | 64px |
| 100px | 200px | 400px |
| 1rem | 2rem | 4rem |

**Nota**: El sistema usa escalado proporcional, no multiplicación directa.

## ⚠️ Consideraciones

1. **Performance**: El hook se actualiza en cada resize - es eficiente pero monitorea el uso
2. **TVs antiguas**: Algunas TVs 2016 pueden tener limitaciones de CSS - usa fallbacks
3. **Zoom del navegador**: El sistema respeta el zoom del usuario
4. **Aspect Ratio**: Considera diferentes ratios (16:9, 21:9, etc.)

