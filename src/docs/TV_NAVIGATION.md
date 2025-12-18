# Sistema de Navegación TV

## Descripción

Implementación propia de navegación espacial compatible con React 19. Sin dependencias externas.

## Características

- ✅ Compatible con React 19
- ✅ Navegación con flechas del control remoto
- ✅ Soporte para Enter/OK
- ✅ Sin dependencias externas
- ✅ Detección automática del elemento más cercano
- ✅ Solo activo cuando `isTV = true`

## Archivos Principales

```
src/
├── hooks/
│   └── useSpatialNavigation.js    # Hook y lógica de navegación
├── contexts/
│   └── TVNavigationContext.jsx    # Provider que inicializa en TV
└── components/
    └── Focusable.jsx              # Wrapper para elementos navegables
```

## Uso Básico

### 1. Envolver la App con el Provider

```jsx
// App.jsx
import { TVNavigationProvider } from './contexts/TVNavigationContext';

function App() {
  return (
    <TVNavigationProvider>
      <YourApp />
    </TVNavigationProvider>
  );
}
```

### 2. Usar el Componente Focusable

```jsx
import { Focusable } from '../components/Focusable';

function MyComponent() {
  return (
    <div>
      <Focusable focusKey="button-1" onEnterPress={() => console.log('Pressed!')}>
        <button>Mi Botón</button>
      </Focusable>
      
      <Focusable focusKey="input-1">
        <input type="text" placeholder="Escribe aquí" />
      </Focusable>
    </div>
  );
}
```

### 3. Props del Componente Focusable

| Prop | Tipo | Descripción |
|------|------|-------------|
| `focusKey` | `string` | **Requerido**. Identificador único del elemento |
| `onFocus` | `function` | Callback cuando recibe foco |
| `onBlur` | `function` | Callback cuando pierde foco |
| `onEnterPress` | `function` | Callback cuando se presiona Enter |
| `className` | `string` | Clases CSS adicionales |
| `style` | `object` | Estilos inline adicionales |

## Teclas Soportadas

| Tecla | Acción |
|-------|--------|
| ↑ / ArrowUp | Navegar arriba |
| ↓ / ArrowDown | Navegar abajo |
| ← / ArrowLeft | Navegar izquierda |
| → / ArrowRight | Navegar derecha |
| Enter / Space | Activar elemento |
| Escape / Backspace | Volver (opcional) |

## Estilos

Los elementos focusables reciben automáticamente:

- Clase `.focusable` siempre
- Clase `.focused` cuando tienen foco
- Atributo `data-focusable="true"`
- Atributo `data-focus-key="[focusKey]"`

### Estilos por Defecto

```scss
.focusable {
  transition: outline 0.15s ease;
  
  &.focused {
    outline: 3px solid var(--primary-color, #667eea);
    outline-offset: 2px;
  }
}
```

### Personalizar Estilos

```scss
// En tu componente
.mi-componente {
  .focusable.focused .mi-boton {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
  }
}
```

## API del Hook

### useFocusable

```jsx
import { useFocusable } from '../hooks/useSpatialNavigation';

function MyCustomComponent() {
  const { ref, focused, focus } = useFocusable({
    focusKey: 'my-element',
    onFocus: () => console.log('Focused'),
    onBlur: () => console.log('Blurred'),
    onEnterPress: () => console.log('Enter pressed'),
  });

  return (
    <div ref={ref} className={focused ? 'my-focused-style' : ''}>
      Contenido
    </div>
  );
}
```

### setFocus (manual)

```jsx
import { setFocus } from '../hooks/useSpatialNavigation';

// Establecer foco programáticamente
setFocus('my-element-key');
```

## Comportamiento en PC vs TV

| Aspecto | PC | TV |
|---------|----|----|
| Focusable wrapper | No se renderiza | Se renderiza |
| Navegación | Tab nativo | Flechas direccionales |
| Estilos de foco | CSS `:focus` nativo | Clase `.focused` |
| tabIndex | Normal (0) | Deshabilitado (-1) |

## Notas de Implementación

1. **Algoritmo de navegación**: Busca el elemento más cercano en la dirección presionada, priorizando alineación vertical/horizontal.

2. **Throttling**: Hay 100ms de throttling entre eventos de tecla para evitar navegación demasiado rápida.

3. **Auto-scroll**: Los elementos enfocados hacen scroll automático para ser visibles.

4. **Registro automático**: Los elementos se registran/desregistran automáticamente cuando se montan/desmontan.

## Migración desde Librerías Externas

Si vienes de `@noriginmedia/react-spatial-navigation` o `react-tv-space-navigation`:

1. Estas librerías usan APIs deprecadas de React 18 (`createFactory`, `findDOMNode`)
2. No son compatibles con React 19
3. Esta implementación propia es más ligera y compatible
