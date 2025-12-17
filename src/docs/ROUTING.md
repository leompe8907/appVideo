# Sistema de Routing con React Router DOM

Navegación completa implementada con React Router DOM v7.

## 📁 Estructura

```
src/
├── App.jsx                      # Solo renderiza Router
├── routes/
│   └── AppRouter.jsx            # Configuración de rutas
├── layouts/
│   └── MainLayout.jsx           # Layout con nav
├── pages/
│   ├── LoginPage.jsx            # Página de login
│   ├── HomePage.jsx             # Dashboard principal
│   ├── ChannelsPage.jsx         # Canales en vivo
│   ├── VodPage.jsx              # Video on demand
│   ├── EpgPage.jsx              # Guía EPG
│   └── SettingsPage.jsx         # Configuración
└── styles/components/
    ├── _layout.scss             # Estilos layout
    └── _pages.scss              # Estilos páginas
```

---

## 🛣️ Rutas Disponibles

### Rutas Públicas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | LoginPage | Pantalla de login |

### Rutas Protegidas (requieren autenticación)

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/home` | HomePage | Dashboard principal |
| `/channels` | ChannelsPage | Listado de canales |
| `/vod` | VodPage | Catálogo VOD |
| `/epg` | EpgPage | Guía de programación |
| `/settings` | SettingsPage | Configuración |

---

## 🔐 Protección de Rutas

Las rutas están protegidas con el componente `ProtectedRoute`:

```jsx
function ProtectedRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('cvSessionId');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
```

**¿Cómo funciona?**
1. Verifica si existe `cvSessionId` en localStorage
2. Si NO existe → Redirige a login (`/`)
3. Si existe → Permite acceso a la ruta

---

## 🎨 Layout Principal

`MainLayout.jsx` envuelve todas las rutas protegidas:

**Componentes:**
- **Header** con logo y botón logout
- **Navegación** con tabs activos
- **Outlet** para contenido de páginas
- **Footer** con info de la app

**Navegación Activa:**
```jsx
<NavLink to="/home" className="nav-link">
  🏠 Inicio
</NavLink>
```

La clase `active` se aplica automáticamente.

---

## 💻 Uso en Componentes

### Navegar Programáticamente

```jsx
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/channels');
  };

  return <button onClick={handleClick}>Ver Canales</button>;
}
```

### Links Simples

```jsx
import { Link } from 'react-router-dom';

<Link to="/vod" className="btn btn-primary">
  Ver VOD
</Link>
```

### Links con Estado Activo

```jsx
import { NavLink } from 'react-router-dom';

<NavLink 
  to="/epg" 
  className={({ isActive }) => isActive ? 'active' : ''}
>
  EPG
</NavLink>
```

### Obtener Parámetros

```jsx
import { useParams } from 'react-router-dom';

function ChannelDetail() {
  const { channelId } = useParams();
  return <div>Canal ID: {channelId}</div>;
}

// Ruta: /channels/:channelId
```

### Query Params

```jsx
import { useSearchParams } from 'react-router-dom';

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q');

  return <div>Búsqueda: {query}</div>;
}

// URL: /search?q=action
```

---

## 🔄 Flujo de Navegación

```
1. Usuario accede → "/"
2. No autenticado → LoginPage
3. Login exitoso → navigate('/home')
4. Usuario navega → Links en nav
5. Usuario hace logout → Limpia session → navigate('/')
6. Intento acceso sin auth → Redirect a "/"
```

---

## ➕ Agregar Nueva Página

### 1. Crear componente

```jsx
// src/pages/MyNewPage.jsx
export function MyNewPage() {
  return (
    <div className="my-new-page">
      <h1>Mi Nueva Página</h1>
    </div>
  );
}

export default MyNewPage;
```

### 2. Agregar ruta

```jsx
// src/routes/AppRouter.jsx
import { MyNewPage } from '../pages/MyNewPage';

<Route path="/mynew" element={<MyNewPage />} />
```

### 3. Agregar a navegación

```jsx
// src/layouts/MainLayout.jsx
<NavLink to="/mynew" className="nav-link">
  ✨ Nueva
</NavLink>
```

### 4. Agregar estilos (opcional)

```scss
// src/styles/components/_pages.scss
.my-new-page {
  @include card($spacing-xl, $border-radius-md);
  min-height: 400px;
}
```

---

## 🎯 Rutas con Parámetros

### Agregar ruta dinámica

```jsx
// src/routes/AppRouter.jsx
<Route path="/channels/:channelId" element={<ChannelDetail />} />
<Route path="/player/:videoId" element={<PlayerPage />} />
```

### Usar en componente

```jsx
// src/pages/ChannelDetail.jsx
import { useParams } from 'react-router-dom';

export function ChannelDetail() {
  const { channelId } = useParams();

  // Llamar API con channelId
  // ...

  return <div>Detalles del canal {channelId}</div>;
}
```

### Navegar con params

```jsx
// Desde otro componente
navigate(`/channels/${channelId}`);

// O con Link
<Link to={`/channels/${channelId}`}>Ver Canal</Link>
```

---

## 🚀 Rutas Anidadas

```jsx
// Ejemplo: Rutas de VOD con categorías
<Route path="/vod" element={<VodLayout />}>
  <Route index element={<VodHome />} />
  <Route path="movies" element={<Movies />} />
  <Route path="series" element={<Series />} />
  <Route path="kids" element={<Kids />} />
</Route>

// VodLayout.jsx tendrá <Outlet /> para mostrar sub-rutas
```

---

## 🔀 Redirecciones

### Redirect simple

```jsx
<Route path="/old-path" element={<Navigate to="/new-path" replace />} />
```

### Redirect condicional

```jsx
function ConditionalRedirect() {
  const condition = true;

  if (condition) {
    return <Navigate to="/target" replace />;
  }

  return <div>Contenido</div>;
}
```

---

## 🎨 Estilos de Navegación

### Active state automático

```scss
// src/styles/components/_layout.scss
.nav-link {
  &.active {
    color: $primary-color;
    border-bottom-color: $primary-color;
    font-weight: 600;
  }
}
```

### Focus state para TVs

```scss
.nav-link {
  @include focus-state; // Outline para navegación con control remoto
}
```

---

## 📱 Responsive

La navegación es responsive automáticamente:

```scss
@include mobile {
  .nav-tabs {
    overflow-x: auto; // Scroll horizontal en móvil
    white-space: nowrap;
  }
}
```

---

## 🔧 Configuración Avanzada

### Basename (para subdirectorios)

```jsx
<BrowserRouter basename="/app">
  {/* Rutas relativos a /app/ */}
</BrowserRouter>
```

### Scroll Restoration

```jsx
import { ScrollRestoration } from 'react-router-dom';

<ScrollRestoration />
```

### Lazy Loading

```jsx
import { lazy, Suspense } from 'react';

const ChannelsPage = lazy(() => import('./pages/ChannelsPage'));

<Route 
  path="/channels" 
  element={
    <Suspense fallback={<Loading />}>
      <ChannelsPage />
    </Suspense>
  } 
/>
```

---

## 🐛 Debugging

### Ver ruta actual

```jsx
import { useLocation } from 'react-router-dom';

function MyComponent() {
  const location = useLocation();
  console.log(location.pathname); // "/channels"
  console.log(location.search);   // "?filter=hd"
}
```

### Ver navegación

```jsx
import { useNavigationType } from 'react-router-dom';

const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
```

---

## ✅ Checklist Implementado

- [x] React Router DOM instalado
- [x] Estructura de pages/
- [x] MainLayout con navegación
- [x] Rutas protegidas
- [x] LoginPage con redirect
- [x] HomePage (Dashboard)
- [x] ChannelsPage
- [x] VodPage
- [x] EpgPage
- [x] SettingsPage
- [x] Navegación con tabs activos
- [x] Logout funcional
- [x] Estilos responsive
- [x] Focus states para TVs

---

## 🔜 Próximos Pasos Sugeridos

1. **Player Page** → Página de reproductor con params
2. **VOD Detail** → Detalle de película/serie
3. **Channel Detail** → Detalle de canal con EPG
4. **Search Page** → Búsqueda global
5. **Profile Management** → Si profiles está enabled
6. **Error 404** → Página de error personalizada

---

## 📚 Referencias

- [React Router Docs](https://reactrouter.com/)
- [NavLink API](https://reactrouter.com/en/main/components/nav-link)
- [useNavigate Hook](https://reactrouter.com/en/main/hooks/use-navigate)

