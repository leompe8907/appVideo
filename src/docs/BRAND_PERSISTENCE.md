# 💾 Persistencia de Brand - Guía

## 🎯 Resumen

El sistema ahora guarda automáticamente el brand seleccionado en `localStorage` para mantenerlo entre sesiones y refrescos del servidor.

## 📋 Prioridad de Carga

El brand se carga en el siguiente orden de prioridad:

1. **URL Parameter** (`?brand=xxx`) - Máxima prioridad
2. **localStorage** (`brand`) - Persistencia entre sesiones
3. **Default Brand** (del build)
4. **Fallback** (bromteck)

## 🔄 Comportamiento

### Al Cargar la App

```javascript
// 1. Busca en URL
?brand=intv → Carga intv y guarda en localStorage

// 2. Si no hay URL, busca en localStorage
localStorage.getItem('brand') → 'intv' → Carga intv

// 3. Si no hay localStorage, usa default
DEFAULT_BRAND → Carga default y guarda en localStorage
```

### Al Cambiar de Brand

```javascript
// Desde código
changeBrand('intv'); // Guarda automáticamente en localStorage

// Desde URL
?brand=gigmax // Guarda automáticamente en localStorage
```

### Al Refrescar/Recargar

- Si estás en `intv` y refrescas → Sigue en `intv` (desde localStorage)
- Si cambias a `gigmax` y refrescas → Sigue en `gigmax` (desde localStorage)
- Si usas `?brand=bromteck` → Cambia a `bromteck` y guarda en localStorage

## 🛠️ Uso Manual

### Ver Brand Actual en localStorage

```javascript
console.log(localStorage.getItem('brand')); // 'intv', 'gigmax', etc.
```

### Cambiar Brand Manualmente

```javascript
// Desde código
import { useBrand } from '../contexts/BrandContext';

const { changeBrand } = useBrand();
changeBrand('intv'); // Cambia y guarda automáticamente
```

### Limpiar Brand (volver a default)

```javascript
localStorage.removeItem('brand');
// Recargar la página para aplicar
```

## ⚠️ Notas Importantes

1. **URL siempre gana**: Si hay `?brand=xxx` en la URL, siempre se usa ese (y se guarda)
2. **Persistencia automática**: No necesitas hacer nada, se guarda automáticamente
3. **Sincronización entre pestañas**: Si cambias el brand en una pestaña, las otras se actualizan automáticamente

## 🔍 Debugging

### Ver Logs

El sistema muestra logs en consola:

```
[Brand] Cargado desde URL: intv
[Brand] Cargado desde localStorage: intv
[Brand] Cargado por defecto: bromteck
[Brand] Usando fallback: bromteck
```

### Verificar Estado

```javascript
// En consola del navegador
localStorage.getItem('brand'); // Ver brand guardado
```

## ✅ Beneficios

- ✅ No pierdes el brand al refrescar
- ✅ Mantiene preferencia entre sesiones
- ✅ Funciona con hot reload (desarrollo)
- ✅ Sincronización automática entre pestañas

