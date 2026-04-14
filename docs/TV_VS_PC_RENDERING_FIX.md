# Guía de Solución: Renderizado TV vs PC

**Problema:** El contenido se ve "deforme" en TVs comparado con PCs  
**Fecha:** 13 de abril de 2026

---

## Diagnóstico Completo

### Problema #1: `object-fit: fill` Estira Imágenes de Canales 🔴 CRÍTICO

**Archivo:** `src/styles/pages/_bouquet.scss` (línea ~335)

```scss
.channel-card-img {
  object-fit: fill; /* ❌ ESTIRA la imagen sin respetar aspect ratio */
}
```

**Por qué causa deformación:**
- Las imágenes de logos de canales tienen diferentes aspect ratios (16:9, 4:3, 1:1)
- `object-fit: fill` fuerza la imagen a caber en el contenedor de 14em × 13em (~1.07:1)
- En PC a 1920px, esto es sutil (224×208px)
- En TV a 4K con font-size 20px, esto es 280×260px — la deformación es más visible

**Solución:**

```scss
.channel-card-img {
  object-fit: contain; /* ✅ Mantiene aspect ratio, agrega padding si necesario */
  /* O alternativamente: */
  object-fit: cover;   /* ✅ Recorta para llenar, sin deformar */
}
```

**Recomendación:** Usar `object-fit: contain` para logos de canales (se ve completo) o `object-fit: cover` para thumbnails de contenido (se ve centrado).

---

### Problema #2: Lógica de Viewport Scale con Dead Code 🟡 ALTO

**Archivo:** `src/hooks/useViewport.js` (líneas 39-43)

```javascript
let scale = 1;
if (width >= 1920) {
  scale = width / 1920;  // 1920 → 1.0, 3840 → 2.0
} else if (width < 1920) {
  scale = width / 1920;  // ❌ IDÉNTICO al if anterior (dead code)
}
```

**Problema:** Ambas ramas son idénticas. El `else if` nunca se ejecuta de forma diferente.

**Además en `src/App.jsx` (línea 85):**

```javascript
const scaleValue = viewport.scale > 1.5 ? viewport.scale : 1;
root.style.setProperty('--viewport-scale', String(scaleValue));
```

**Problema mayor:** `--viewport-scale` se establece pero **NUNCA se usa en ningún archivo SCSS**.  
Grep de `var(--viewport-scale)` en todos los archivos `.scss` = **0 resultados**.

**Solución:**

Opción A — Eliminar código muerto:
```javascript
// En useViewport.js
let scale = 1;
if (width >= 1920) {
  scale = width / 1920;
}
// Eliminar el else if redundante

// En App.jsx
// Eliminar las líneas que setean --viewport-scale (no se usa)
```

Opción B — Realmente usar la variable en SCSS:
```scss
// En _responsive.scss o _variables.scss
.app-container {
  transform: scale(var(--viewport-scale, 1));
  transform-origin: top left;
}
```

**Recomendación:** Opción A (eliminar código muerto). El sistema de scaling ya funciona con clases CSS (`.mobile`, `.desktop`, `.tv-4k`, etc.) y media queries.

---

### Problema #3: Grid Vertical Sin Reglas para TV 4K/8K 🟡 MEDIO

**Archivo:** `src/styles/pages/_bouquet.scss` (líneas 260-270)

```scss
:root.desktop & .bouquet-grid-vertical .bouquet-grid-vertical-content,
:root.hd & .bouquet-grid-vertical .bouquet-grid-vertical-content,
:root.fullhd & .bouquet-grid-vertical .bouquet-grid-vertical-content {
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

/* ❌ NO hay regla para :root.tv-4k ni :root.tv-8k */
```

**Consecuencia:**
- TV 4K (3840px): 6 columnas → cada tarjeta ~640px de ancho
- TV 8K (7680px): 6 columnas → cada tarjeta ~1280px de ancho
- Tarjetas enormes, imágenes pixeladas, layout poco usable

**Solución:**

```scss
// Agregar reglas específicas para TVs de alta resolución
:root.tv-4k & .bouquet-grid-vertical .bouquet-grid-vertical-content {
  grid-template-columns: repeat(8, minmax(0, 1fr)); /* 8 columnas en 4K */
}

:root.tv-8k & .bouquet-grid-vertical .bouquet-grid-vertical-content {
  grid-template-columns: repeat(12, minmax(0, 1fr)); /* 12 columnas en 8K */
}
```

---

### Problema #4: Transform Scale Anidados en Focus 🟡 MEDIO

**Archivo:** `src/styles/global.scss` (líneas 141-218)

```scss
/* En TV, los elementos focused tienen mayor scale */
.device-tv .focused {
  transform: scale(1.05);
}

.device-tv button.focused {
  transform: scale(1.08);
}

.device-tv a.focused,
.device-tv .nav-card.focused {
  transform: scale(1.12);
}
```

**Problema:** Si un elemento `.nav-card.focused` está dentro de un contenedor que ya tiene `transform: scale()`, los transforms se **componen**:

```
transform final = 1.01 (home-shell) × 1.12 (nav-card) = 1.1312
```

Esto puede causar:
- Elementos que se salen de su contenedor
- Clip de texto o imágenes
- Renderizado borroso en TVs con hardware limitado

**Solución:**

En lugar de `transform: scale()`, usar:
```scss
.device-tv .nav-card.focused {
  /* Sin transform */
  box-shadow: 0 0 0 3px #fff, 0 8px 24px rgba(0,0,0,0.3);
  border-color: #fff;
  /* Indicadores visuales sin transform geométrico */
}
```

O si se necesita scale, aplicar `transform: none` al contenedor padre:
```scss
.home-shell-ui--hidden {
  /* transform: scale(1.01); ❌ Quitar */
  opacity: 0;
  visibility: hidden;
}
```

---

### Problema #5: Overscan en TVs 🟢 BAJO

**Descripción:**  
Muchas TVs aplican **overscan** (recorte de bordes) por defecto. Esto significa que `100vw` no corresponde al ancho físico de la pantalla.

**Síntomas:**
- Contenido cortado en los bordes
- `clamp()` con `vw` calcula valores incorrectos
- Scrollbars aparecen inesperadamente

**Solución:**

Agregar "safe area" padding en el contenedor principal:

```scss
.App {
  /* Padding de seguridad para compensar overscan */
  padding: 2vh 2vw;
  box-sizing: border-box;
}

/* O usar env() si la TV soporta CSS env variables */
.App {
  padding: env(safe-area-inset-top, 2vh) env(safe-area-inset-right, 2vw)
           env(safe-area-inset-bottom, 2vh) env(safe-area-inset-left, 2vw);
}
```

---

## Resumen de Cambios Requeridos

| # | Cambio | Archivo | Prioridad | Impacto |
|---|--------|---------|-----------|---------|
| 1 | Cambiar `object-fit: fill` → `contain` | `_bouquet.scss` | 🔴 Crítica | Alto |
| 2 | Eliminar dead code de viewport scale | `useViewport.js` + `App.jsx` | 🟡 Alta | Medio |
| 3 | Agregar columnas para 4K/8K | `_bouquet.scss` | 🟡 Media | Medio |
| 4 | Reducir transform scale en focus | `global.scss` + `_home-shell.scss` | 🟡 Media | Bajo |
| 5 | Agregar safe area padding | `_responsive.scss` o `global.scss` | 🟢 Baja | Bajo |

---

## Plan de Implementación

### Paso 1: Corregir object-fit (5 minutos)
```bash
# Editar src/styles/pages/_bouquet.scss
# Cambiar object-fit: fill → object-fit: contain
```

### Paso 2: Limpiar viewport scale dead code (10 minutos)
```bash
# Editar src/hooks/useViewport.js - eliminar else if redundante
# Editar src/App.jsx - eliminar código que setea --viewport-scale
```

### Paso 3: Agregar reglas 4K/8K (5 minutos)
```bash
# Editar src/styles/pages/_bouquet.scss
# Agregar reglas para tv-4k y tv-8k
```

### Paso 4: Probar en TV real
- Verificar que logos de canales ya no se ven estirados
- Verificar que grids se adaptan correctamente en 4K
- Verificar que focus no causa clipping

---

*Documento creado como parte de auditoría técnica. Actualizar después de implementar fixes.*
