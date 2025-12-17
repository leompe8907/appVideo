# Sistema de Conexión Panaccess

Integración completa con el API de Panaccess, adaptada al sistema multi-cliente.

## 📦 Componentes Implementados

```
src/
├── api/cv/
│   ├── cv.js               # Cliente principal Panaccess
│   ├── udid.js             # Generador de UDID único
│   └── errorClassifier.js  # Clasificador de errores
├── hooks/
│   └── usePanaccess.js     # Hook React para conexión
└── components/
    ├── PanaccessLogin.jsx  # Componente de login
    └── PanaccessLogin.css
```

---

## 🚀 Uso Básico

### Opción 1: Con Hook (Recomendada)

```jsx
import { usePanaccess } from './hooks/usePanaccess'
import { getActiveBrandConfig } from './config/brandConfig'

function MyComponent() {
  const brandConfig = getActiveBrandConfig()
  const { connect, call, isConnected, error } = usePanaccess(brandConfig)

  const handleLogin = async () => {
    const success = await connect('usuario', 'password')
    if (success) {
      console.log('Conectado!')
    }
  }

  const getChannels = async () => {
    const channels = await call('getCategories', {})
    console.log(channels)
  }

  return (
    <div>
      {!isConnected ? (
        <button onClick={handleLogin}>Login</button>
      ) : (
        <button onClick={getChannels}>Ver Canales</button>
      )}
      {error && <p>{error}</p>}
    </div>
  )
}
```

### Opción 2: Cliente Directo

```jsx
import { createCVClient } from './api/cv/cv'
import { getActiveBrandConfig } from './config/brandConfig'

async function conectar() {
  const brandConfig = getActiveBrandConfig()
  const client = createCVClient(brandConfig)
  
  // Login
  await client.init('usuario', 'password')
  
  // Llamadas al API
  const categories = await client.call('getCategories', {})
  const channels = await client.call('getChannels', { categoryId: 1 })
  
  console.log(categories, channels)
}
```

### Opción 3: Componente de Login

```jsx
import { PanaccessLogin } from './components/PanaccessLogin'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const brandConfig = getActiveBrandConfig()

  if (!isLoggedIn) {
    return (
      <PanaccessLogin 
        brandConfig={brandConfig}
        onLoginSuccess={() => setIsLoggedIn(true)}
      />
    )
  }

  return <Dashboard />
}
```

---

## 🎯 API del Hook `usePanaccess`

```js
const {
  client,        // Instancia CVClient
  isConnected,   // Boolean: si está conectado
  isLoading,     // Boolean: si está cargando
  error,         // String: mensaje de error
  connect,       // Function: (username, password) => Promise<boolean>
  disconnect,    // Function: () => void
  call,          // Function: (funcName, params) => Promise<any>
} = usePanaccess(brandConfig)
```

---

## 🔧 API del Cliente `CVClient`

### Métodos Principales

```js
// Inicializar y hacer login
await client.init(username, password, apiToken?)

// Llamada al API
const result = await client.call('functionName', { param1: 'value' })

// Validar sesión
const isValid = await client.validateSession()

// Cerrar sesión
client.logout()

// Verificar autenticación
const authenticated = client.isAuthenticated()
```

### Funciones Panaccess Comunes

```js
// Categorías
await client.call('getCategories', {})

// Canales por categoría
await client.call('getChannels', { categoryId: 1 })

// EPG
await client.call('getEpg', { 
  channelId: 123, 
  date: '2024-01-01' 
})

// Stream URL
await client.call('getStreamUrl', { 
  channelId: 123,
  protocol: 'hls' 
})

// VOD
await client.call('getVodCategories', {})
await client.call('getVodContent', { categoryId: 1 })
```

---

## 🎨 Integración Multi-Cliente

El sistema se integra automáticamente con `brandConfig`:

```js
// Cada cliente tiene su DRM y token
const brandConfig = {
  brand: "intv",
  drm: "https://pmdw-1.in.tv.br/",
  token: "CQSepFFsoFNgyLNDYOpz",
  // ...
}

// El cliente se crea automáticamente con estos valores
const client = createCVClient(brandConfig)
```

**Cambiar de cliente:**
```
http://localhost:3001/?brand=intv    → Se conecta al DRM de inTV
http://localhost:3001/?brand=gigmax  → Se conecta al DRM de Gigmax
```

---

## ⚠️ Manejo de Errores

### Tipos de Error

```js
ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',      // Sin internet
  TIMEOUT: 'TIMEOUT_ERROR',      // Timeout excedido
  AUTH: 'AUTH_ERROR',            // Credenciales inválidas
  API: 'API_ERROR',              // Error del API
  UNKNOWN: 'UNKNOWN_ERROR',      // Error desconocido
}
```

### Captura de Errores

```js
try {
  await client.call('getChannels', {})
} catch (error) {
  console.log(error.errorInfo.type)          // Tipo de error
  console.log(error.errorInfo.userMessage)   // Mensaje amigable
  console.log(error.errorInfo.canRetry)      // ¿Se puede reintentar?
}
```

---

## 🔐 Seguridad

- **Password hash automático**: MD5 con salt `_panaccess`
- **SessionId persistente**: Se guarda en localStorage
- **Recuperación de sesión**: Reintenta usar sesión guardada antes de login
- **UDID único**: Generado por dispositivo y persistido

---

## 🚀 Optimizaciones para TVs

- **Timeout configurable**: 30s por defecto (ajustable)
- **Modo JSONP**: Para problemas de CORS
- **Error classification**: Mensajes amigables para el usuario
- **Session recovery**: Evita logins innecesarios
- **Fetch puro**: Sin dependencias pesadas

---

## 📝 Configuración Avanzada

```js
const client = new CVClient({
  baseUrl: 'https://cv10.panaccess.com/',
  apiToken: 'ABC123',
  mode: 'json',           // 'json' o 'jsonp'
  fetchTimeout: 30000,    // Timeout en ms
  jsonpTimeout: 5000,     // Timeout JSONP
})
```

---

## 🐛 Debugging

Activa logs en consola:

```js
// Los logs están incluidos automáticamente
[CV] Sesión recuperada del storage
[CV] Sesión válida
[CV] Login exitoso
[CV] Sesión cerrada
```

---

## ✅ Checklist de Implementación

- [x] Cliente CV con hash MD5
- [x] Generador UDID único
- [x] Clasificador de errores
- [x] Hook React usePanaccess
- [x] Componente de Login
- [x] Integración con brandConfig
- [x] Persistencia de sesión
- [x] Manejo de errores amigable
- [x] Optimizado para TVs 2016

---

## 🔜 Próximos Pasos

1. **Implementar listado de canales**
2. **Crear reproductor de video**
3. **Agregar EPG (guía de programación)**
4. **Implementar VOD**
5. **Agregar favoritos**
6. **Control parental**

