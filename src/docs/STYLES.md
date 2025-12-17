# Sistema de Estilos SCSS + Bootstrap

Arquitectura de estilos organizada con SCSS y Bootstrap para el proyecto OTT.

## 📁 Estructura

```
src/styles/
├── main.scss                    # Punto de entrada principal
├── _variables.scss              # Variables globales
├── _mixins.scss                 # Mixins reutilizables
├── _custom-bootstrap.scss       # Configuración Bootstrap
├── global.scss                  # Estilos globales base
└── components/
    ├── _login.scss              # Estilos del Login
    └── _app.scss                # Estilos del App principal
```

---

## 🎨 Variables Disponibles

### Colores

```scss
$primary-color: var(--primary-color, #667eea);
$secondary-color: var(--secondary-color, #764ba2);
$epg-line-color: var(--epg-line-color, #3333FF);
$success-color: #28a745;
$error-color: #dc3545;
$warning-color: #ffc107;
$info-color: #17a2b8;
```

### Espaciado

```scss
$spacing-xs: 0.25rem;   // 4px
$spacing-sm: 0.5rem;    // 8px
$spacing-md: 1rem;      // 16px
$spacing-lg: 1.5rem;    // 24px
$spacing-xl: 2rem;      // 32px
$spacing-xxl: 3rem;     // 48px
```

### Border Radius

```scss
$border-radius-sm: 4px;
$border-radius-md: 8px;
$border-radius-lg: 12px;
$border-radius-xl: 16px;
```

### Sombras

```scss
$shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
$shadow-md: 0 4px 8px rgba(0, 0, 0, 0.15);
$shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.2);
```

### Transiciones

```scss
$transition-fast: 0.15s ease;
$transition-normal: 0.2s ease;
$transition-slow: 0.3s ease;
```

---

## 🔧 Mixins Disponibles

### Layout

```scss
// Flexbox centrado
@include flex-center;

// Flex personalizado
@include flex(row, center, center);

// Card base
@include card($spacing-lg, $border-radius-md);
```

### Texto

```scss
// Truncar texto
@include text-truncate;

// Limitar líneas
@include line-clamp(3);
```

### Responsive

```scss
// Mobile
@include mobile {
  font-size: 0.875rem;
}

// Tablet
@include tablet {
  display: grid;
}

// Desktop
@include desktop {
  max-width: 1200px;
}

// TV
@include tv {
  font-size: 1.25rem;
}
```

### Componentes

```scss
// Button base
@include button-base;

// Focus state (para control remoto)
@include focus-state;

// Overlay
@include overlay(0.5);

// Aspect ratio
@include aspect-ratio(16, 9);

// Scroll personalizado
@include custom-scrollbar;
```

---

## 🚀 Uso en Componentes

### Opción 1: Estilos en el archivo SCSS del componente

```scss
// src/styles/components/_mi-componente.scss
.mi-componente {
  @include card;
  
  .titulo {
    color: $primary-color;
    margin-bottom: $spacing-md;
  }
  
  .boton {
    @include button-base;
    background: $primary-color;
    
    &:hover {
      background: $secondary-color;
    }
  }
}
```

**Agregar a main.scss:**
```scss
@import 'components/mi-componente';
```

### Opción 2: Usar clases de Bootstrap

```jsx
<div className="container">
  <div className="row">
    <div className="col-md-6">
      <button className="btn btn-primary">Botón</button>
    </div>
  </div>
</div>
```

### Opción 3: Combinar ambas

```jsx
<div className="mi-componente container">
  <h2 className="titulo">Título</h2>
  <button className="btn btn-primary boton-custom">Click</button>
</div>
```

---

## 📦 Bootstrap Incluido

Componentes importados (optimizados):

✅ Grid System  
✅ Containers  
✅ Buttons  
✅ Forms  
✅ Cards  
✅ Alerts  
✅ Badges  
✅ Nav/Navbar  
✅ Modal  
✅ Spinners  
✅ Utilities  

---

## 🎯 Clases Útiles de Bootstrap

### Grid

```jsx
<div className="container">
  <div className="row">
    <div className="col-12 col-md-6 col-lg-4">Columna</div>
  </div>
</div>
```

### Botones

```jsx
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>
<button className="btn btn-success">Success</button>
<button className="btn btn-outline-primary">Outline</button>
```

### Formularios

```jsx
<div className="mb-3">
  <label className="form-label">Email</label>
  <input type="email" className="form-control" />
</div>
```

### Cards

```jsx
<div className="card">
  <div className="card-body">
    <h5 className="card-title">Título</h5>
    <p className="card-text">Contenido</p>
  </div>
</div>
```

### Spacing

```jsx
<div className="mt-3">Margin top</div>
<div className="p-4">Padding all sides</div>
<div className="mx-auto">Margin horizontal auto</div>
```

### Display

```jsx
<div className="d-flex justify-content-center align-items-center">
  Centrado
</div>
```

---

## 💻 Crear Nuevo Componente con Estilos

### 1. Crear archivo SCSS

```scss
// src/styles/components/_mi-componente.scss
.mi-componente {
  @include card($spacing-lg, $border-radius-md);
  
  &__header {
    @include flex(row, space-between, center);
    padding-bottom: $spacing-md;
    border-bottom: 1px solid #eee;
  }
  
  &__title {
    color: $primary-color;
    font-size: $font-size-xl;
  }
  
  &__button {
    @include button-base;
    @include focus-state;
    background: $primary-color;
    
    &:hover {
      background: $secondary-color;
      transform: translateY(-2px);
    }
  }
  
  @include mobile {
    padding: $spacing-md;
  }
}
```

### 2. Importar en main.scss

```scss
@import 'components/mi-componente';
```

### 3. Usar en JSX

```jsx
function MiComponente() {
  return (
    <div className="mi-componente">
      <div className="mi-componente__header">
        <h2 className="mi-componente__title">Título</h2>
        <button className="mi-componente__button">Acción</button>
      </div>
    </div>
  );
}
```

---

## 🔥 Tips y Mejores Prácticas

### 1. Nomenclatura BEM

```scss
.bloque {
  &__elemento {
    // Elemento dentro del bloque
  }
  
  &--modificador {
    // Variación del bloque
  }
}
```

### 2. Usar Variables

```scss
// ❌ Mal
.button {
  padding: 16px;
  color: #667eea;
}

// ✅ Bien
.button {
  padding: $spacing-md;
  color: $primary-color;
}
```

### 3. Usar Mixins

```scss
// ❌ Mal
.card {
  display: flex;
  justify-content: center;
  align-items: center;
  background: white;
  padding: 24px;
  border-radius: 8px;
}

// ✅ Bien
.card {
  @include flex-center;
  @include card($spacing-lg, $border-radius-md);
}
```

### 4. Mobile First

```scss
// ✅ Bien
.elemento {
  font-size: 1rem; // Mobile
  
  @include tablet {
    font-size: 1.125rem; // Tablet+
  }
  
  @include desktop {
    font-size: 1.25rem; // Desktop+
  }
}
```

### 5. Focus States (TVs)

```scss
.button {
  @include button-base;
  @include focus-state; // Importante para navegación con control remoto
}
```

---

## 🎨 Temas Dinámicos

Los colores se actualizan automáticamente según `brandConfig`:

```js
// En JavaScript
applyTheme(brandConfig);

// Actualiza automáticamente:
// --primary-color
// --secondary-color
// --epg-line-color
// --font-family
```

En SCSS, usar con `var()`:

```scss
.elemento {
  color: var(--primary-color);
  font-family: var(--font-family);
}
```

---

## 📝 Checklist

- [x] Variables globales configuradas
- [x] Mixins reutilizables creados
- [x] Bootstrap importado y optimizado
- [x] Estilos de componentes migrados
- [x] Responsive para TVs implementado
- [x] Focus states para control remoto
- [x] Temas dinámicos funcionando
- [x] Documentación completa

---

## 🔜 Extensiones Sugeridas

Para trabajar con SCSS en VS Code:

- **SCSS IntelliSense** - Autocompletado
- **SCSS Formatter** - Formateo automático
- **Live Sass Compiler** - Compilación en tiempo real (opcional)

