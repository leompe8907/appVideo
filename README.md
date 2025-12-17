# Proyecto OTT Multi-Cliente

Aplicación base para múltiples clientes OTT compatible con TVs LG y Samsung 2016.

## 🚀 Uso Rápido

### Desarrollo
```bash
# Desarrollo normal (sin marca específica)
npm run dev

# Ver en: http://localhost:3000
# Cambiar cliente con: http://localhost:3000?brand=bromteck
```

### Builds

```bash
# Build universal (todos los clientes incluidos)
npm run build

# Build para cliente específico
npm run build:telecable
npm run build:bromteck
npm run build:intv
npm run build:gigmax

# Build de todos los clientes a la vez
npm run build:all
```

## 📁 Estructura

```
public/
├── telecable/
│   ├── logo.png              # Logo principal
│   ├── logo-white.png        # Logo versión blanca
│   ├── background.jpg        # Fondo principal
│   ├── favicon.ico           # Favicon
│   ├── splash.jpg            # Splash screen
│   ├── images/               # Imágenes adicionales
│   │   ├── banner.jpg
│   │   └── placeholder.png
│   └── fonts/                # Fuentes custom
│       └── custom-font.woff2
│
├── bromteck/
│   └── ... (misma estructura)
│
├── intv/
│   └── ...
│
├── gigmax/
│   └── ...
│
└── shared/                   # Assets compartidos
    ├── icons/
    │   ├── play.svg
    │   ├── pause.svg
    │   └── stop.svg
    └── placeholders/
        └── no-image.png
```

## Uso en Código

```jsx
// Acceso automático con brandConfig
const { assets } = brandConfig;

<img src={assets.logo} />
<img src={assets.background} />

// Asset custom
<img src={assets.get('images/banner.jpg')} />

// Asset compartido
import { getSharedAsset } from '../utils/assetLoader';
<img src={getSharedAsset('icons/play.svg')} />
```

## Formatos Recomendados para TVs 2016

- **Logos**: PNG (transparencia) < 100KB
- **Backgrounds**: JPG optimizados < 500KB
- **Icons**: SVG o PNG pequeños < 20KB
- **Fuentes**: WOFF2 (mejor soporte)

## Optimización

- Comprime imágenes antes de subir
- Usa dimensiones apropiadas (no más de 1920x1080)
- Evita GIFs animados pesados
- Prefiere JPG para fotos, PNG para logos/iconos


## 🎯 Modos de Uso

### 1. Build Universal + Query Params
```bash
npm run build
# Desplegar dist/
# Acceso: https://tudominio.com?brand=bromteck
```

### 2. Builds Individuales
```bash
npm run build:telecable
# Desplegar dist/telecable/ en https://telecable.tudominio.com
```

### 3. Builds Separados
```bash
npm run build:all
# Desplegar cada carpeta dist/{brand}/ por separado
```

## ➕ Agregar Nuevo Cliente

1. Editar `src/config/brands.js`
2. Agregar script en `package.json`:
```json
"build:nuevocliente": "cross-env VITE_BRAND=nuevocliente VITE_DEFAULT_BRAND=nuevocliente vite build"
```

## 🔧 Optimizaciones para TVs 2016

- Target ES2015
- CSS compatible con Chrome 61
- Minificación agresiva
- Code splitting de vendors
- Drop console en producción
