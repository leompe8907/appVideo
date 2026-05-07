# Auditoría Técnica OTT — Reporte Completo

**Fecha:** 6 de mayo de 2026  
**Stack:** React 18.3 + Vite 7 + React Router v7 + Zustand 5  
**Target:** LG webOS 4.x (Chrome 61) / Samsung Tizen 4.x (Chrome 69)  
**Auditado por:** Agente de IA — Cursor Sonnet 4.6

---

## 1. Mapa del Proyecto

### Arquitectura general

```
main.jsx
  └── ErrorBoundary
       └── BrowserRouter
            └── DeviceProvider (detección TV/PC)
                 └── BrandProvider (configuración multi-marca)
                      └── AppQueryProvider (TanStack Query)
                           └── App.jsx
                                └── PlayerProvider (engine global)
                                     └── Routes (lazy-loaded pages)
```

### Flujo de navegación

```
/ (SplashPage) → /login (LoginPage) → /preload (PreloadDataPage)
                                            ↓
/home/inicio | /home/vod | /home/epg | /home/catchup | /home/buscador
/home/servicios-tv-radio | /home/control-parental | /home/osms
```

### Inventario de módulos

| Categoría              | Módulos                                                                                                                        |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| **Páginas** (15)       | Splash, Login, Profile, SmartCard, PreloadData, Home, Bouquet, TvRadio, Vod, Search, EpgCards, Catchup, ParentalSettings, Osms |
| **Contextos** (5)      | Brand, Device, Player, HomeHeader, PlayerContext                                                                               |
| **Stores Zustand** (6) | preloadStore, inactivityStore, osmsStore, parentalStore, parentalGateStore, epgReminderStore                                   |
| **Hooks** (7)          | useAuthValidator, useDeviceDetection, useDeviceTime, useDebouncedValue, useOsmsPolling, useParentalGate, useUdidLoginFlow      |
| **Servicios** (8)      | panaccessService, tvDataService, loginFlow, epgService, vodService, osmsService, facebookSocialLogin, googleSocialLogin        |
| **Player Engines**     | WebEngine (HLS.js), LgEngine (webOS Luna/DRM), SamsungEngine (AVPlay/Tizen)                                                    |
| **Workers**            | epgWorkerClient (Blob inline)                                                                                                  |
| **Config**             | brands.js (1688 líneas), brandConfig.js, defaultBrand.js                                                                       |

---

## 2. Análisis de Dependencias e Integración

### Flujo de datos principal

```
BrandContext → panaccessService.initialize()
                   ↓
UserSession (localStorage) ← loginFlow.loginAndActivateLicense()
                   ↓
PreloadStore → tvDataService → getBouquetsWithChannels()
                             → loadEPGForStreams()
                   ↓
PlayerContext (engine singleton) → WebEngine / LgEngine / SamsungEngine
```

### Dependencias críticas evaluadas para WebKit 2019

| Librería                | Versión| Estado                                                                                    |
|-------------------------|--------|-------------------------------------------------------------------------------------------|
| `react`                 | 18.3.1 | ✅ Compatible (con `ReactDOM.render`)                                                    |
| `react-router-dom`      | 7.11.0 | ⚠️ v7 sin SSR — no usa APIs incompatibles; ok                                            |
| `hls.js`                | 1.6.15 | ⚠️ Solo se activa en `WebEngine` (browser/PC); LG/Samsung usan native. Sin riesgo en TV  |
| `zustand`               | 5.0.12 | ⚠️ Zustand 5 usa `useSyncExternalStore` (React 18+) — ok con React 18.3                  |
| `@react-oauth/google`   | 0.13.5 | ⚠️ Usa `crypto.subtle` y APIs modernas. **Correctamente deshabilitado en TV** (`!isTV`)  |
| `crypto-js`             | 4.2.0  | ✅ Puro JS, compatible                                                                   |
| `qrcode`                | 1.5.4  | ✅ Compatible                                                                            |
| `bootstrap`             | 5.3.8  | ⚠️ CSS Grid/Flexbox — ok en Chrome 61+; algunos props muy nuevos pueden fallar           |
| `@vitejs/plugin-legacy` | 8.0.1  | ✅ Configurado correctamente para Chrome 61                                              |
| `node-forge`            | 1.0.0  | ✅ Puro JS, compatible                                                                   |

---

## 3. Evaluación Técnica

### Player Engine

La arquitectura de engines es sólida: `BaseEngine → BaseTvEngine → LgEngine/SamsungEngine`, con `WebEngine` independiente. El factory `createEngine` resuelve la plataforma correctamente. Los engines nativos tienen detección por capabilities antes de llamar APIs, lo que protege contra `TypeError` en TVs con versiones de firmware distintas.

### Manejo de Estado

`PreloadStore` está escrito en estilo ES5 (`function`, `var`, `Object.keys().forEach`) conscientemente. Esto es buena práctica para compatibilidad con el chunking de Vite en producción en Chrome 61.

### Compatibilidad TV

- `tvRemote.js` abstrae correctamente los keyCodes de Samsung (10009) y LG (461).
- `escape()` en `LgEngine._webosBuildMediaOption` es la función deprecated global, no `encodeURIComponent`.
- El Worker inline (Blob) en `epgWorkerClient.js` evita los problemas de rutas SPA — buena decisión.

---

## 4. Hallazgos Clasificados

---

### 🔴 Puntos Críticos

---

#### [CRÍTICO-1] Stale closure en `PlayerContext` — `tryRecoverAfterError` captura `currentBrand` en null

**Archivo:** `src/contexts/PlayerContext.jsx` — líneas 102–307

El `useEffect` que crea el engine tiene `[]` como dependencias, por lo tanto captura `currentBrand` del render inicial. `BrandProvider` emite un spinner de carga antes de exponer `currentBrand`, por lo que en el momento en que el engine se crea, `currentBrand` es `null` en el closure. Cuando el engine falle durante la reproducción y se llame `tryRecoverAfterError`, la función retornará `false` inmediatamente sin intentar recuperar.

**Impacto:** La recuperación automática de errores del player **nunca funciona en producción**.

```javascript
// PROBLEMA: currentBrand capturado al montar (es null)
useEffect(() => {
  const tryRecoverAfterError = async (err, snapshot) => {
    if (!currentBrand) return false; // siempre es null
    // ...
  };
}, []); // Array vacío
```

---

#### [CRÍTICO-2] `epgWorkerClient.js` — funciones en `startDate`/`endDate` no sobreviven el structured clone

**Archivo:** `src/workers/epgWorkerClient.js` — líneas 41–47

`postMessage` usa el structured clone algorithm. Las funciones **no son transferibles** — se pierden silenciosamente. Los objetos `startDate` y `endDate` con `valueOf` como función llegarán al hilo principal como objetos vacíos `{}`. Todo código que compare fechas de eventos EPG fallará con resultados incorrectos.

**Impacto:** El EPG muestra eventos desordenados o con horario incorrecto.

```javascript
// PROBLEMA: las funciones no se serializan por postMessage
out.push(Object.assign({}, event, {
  startDate: { valueOf: function () { return startMs; } }, // función = no transferible
  endDate:   { valueOf: function () { return endMs; } }    // función = no transferible
}));
```

---

#### [CRÍTICO-3] `PlayerContext.jsx` — memory leak de event listeners al recrear engine por cambio de plataforma

**Archivo:** `src/contexts/PlayerContext.jsx` — líneas 322–325

Se intenta des-registrar `TIME_UPDATE` con una nueva función flecha anónima `() => {}` que **no coincide** con ningún handler registrado (el método `off` usa comparación por referencia). El engine anterior queda destruido pero todos sus handlers internos (`handleTime`, `handleError`, etc.) permanecen registrados. En una sesión larga produce un memory leak acumulativo.

```javascript
// PROBLEMA: la función anónima no coincide con ningún handler registrado
engineRef.current.off(PLAYER_ENGINE_EVENTS.TIME_UPDATE, () => {}); // no-op
engineRef.current.destroy();
```

---

#### [CRÍTICO-4] `panaccessService.js` — credenciales expuestas en logs (dependiente de Terser)

**Archivo:** `src/services/panaccessService.js` — líneas 44, 136

`parameters` incluye `pwd` (contraseña antes del hash) sin guard `import.meta.env.DEV`. El proyecto depende de `drop_console: !isDev` en Terser para eliminar estos logs. Si el build se ejecuta en modo `development` o si Terser falla, las contraseñas se loguean en texto plano. En LG webOS el log puede persistir en sistemas de debug del dispositivo.

```javascript
// SIN guard DEV — expone pwd en cada login
console.log("Llamando a la API (login):", method, parameters);
// SIN guard DEV — expone sessionId en cada llamada
console.log("Llamando a la API (autenticada):", method, parameters);
```

---

#### [CRÍTICO-5] `LgEngine.js` — uso de `escape()` deprecated

**Archivo:** `src/player/engines/lg/LgEngine.js` — líneas 272–275

`escape()` es una función global deprecated que maneja incorrectamente caracteres Unicode (convierte a `%uXXXX` en vez de UTF-8). El `mediaOption` de webOS requiere URL encoding estándar. En algunos firmwares de webOS 6+ ya no está disponible.

```javascript
// PROBLEMA: escape() deprecated, encoding incorrecto
return escape(JSON.stringify(options));
// CORRECTO:
return encodeURIComponent(JSON.stringify(options));
```

---

#### [CRÍTICO-6] `BrandContext.jsx` — recarga del brand en cada navegación SPA por `popstate`

**Archivo:** `src/contexts/BrandContext.jsx` — líneas 119–123

En una SPA con React Router, el evento `popstate` se dispara en **cada navegación** (back/forward del historial). Cada disparo llama `loadBrandConfig()` que: parsea `brands.js` (1688 líneas), reinicializa `panaccessService`, y aplica el tema al DOM. En TVs con CPU limitada esto genera jank visible en cada navegación. El brand no cambia durante la sesión.

```javascript
// PROBLEMA: se dispara en cada navegación SPA
const handlePopState = () => {
  loadBrandConfig(); // reinicializa todo el sistema de marca
};
window.addEventListener('popstate', handlePopState);
```

---

### ⚠️ Áreas de Mejora

---

#### [MEJORA-1] `preloadStore.js` — N+1 requests secuenciales en catchup

**Archivo:** `src/store/preloadStore.js` — líneas 421–435

Para `N` grupos de catchup, se hacen `N+1` requests HTTP secuenciales dentro de un `for await`. En TVs con conexión de 3–10 Mbps y latencia alta, 30 canales de catchup equivalen a ~30 requests que pueden tardar 15–30 segundos.

---

#### [MEJORA-2] `useAuthValidator.js` — validación de sesión en cada montaje de ruta protegida

**Archivo:** `src/hooks/useAuthValidator.js` — líneas 31–34

`AuthValidator` se monta en cada `ProtectedRoute`. Cada navegación entre rutas protegidas llama al API `loggedIn` de Panaccess. Además, al re-ejecutarse el efecto por cambio de `currentBrand` (causado por CRÍTICO-6), puede haber múltiples intervalos concurrentes.

---

#### [MEJORA-3] `LoginPage.jsx` — componente de 1050 líneas con responsabilidades múltiples

**Archivo:** `src/pages/LoginPage.jsx`

La página mezcla: estado del formulario, navegación por teclado TV, lógica de QR, flujo UDID, social login (Google + Facebook), generación de QR codes, y rendering condicional. Los modales (QR, UDID) son candidatos naturales para componentes separados.

---

#### [MEJORA-4] `DeviceContext.jsx` — getters redundantes en value

**Archivo:** `src/contexts/DeviceContext.jsx` — líneas 48–57

Los `get` accessors duplican propiedades ya presentes en `...deviceInfo`. Cualquier consumidor del contexto obtiene los valores duplicados.

---

#### [MEJORA-5] `preloadStore.js` — `set()` en actualizaciones de progreso reconstruye estado completo

**Archivo:** `src/store/preloadStore.js` — líneas 184–192

Cada tick de progreso de EPG genera un objeto de estado completamente nuevo, re-renderizando todos los suscriptores del store. En TVs con CPU limitada y muchos canales (> 100), esto puede generar decenas de re-renders durante la carga.

---

#### [MEJORA-6] `panaccessService.js` — singleton sin reset de sesión entre marcas

**Archivo:** `src/services/panaccessService.js`

Si la app cambia de marca (`changeBrand`), `panaccessService.initialize()` reasigna `this.client`, pero el `this.brandConfig` anterior puede quedar en estado inconsistente. No hay un método `reset()` explícito.

---

#### [MEJORA-7] `useDeviceDetection.js` — escritura a `localStorage` en detección automática

**Archivo:** `src/hooks/useDeviceDetection.js` — líneas 159–161

En el path de detección automática escribe a `localStorage` como efecto secundario. Si el resultado fue un falso positivo (TV detectada como PC o viceversa), el valor persiste entre sesiones y no puede corregirse sin limpiar el storage manualmente.

---

### ✅ Puntos Fuertes

---

#### [FORTALEZA-1] Configuración de Vite para compatibilidad TV — bien documentada

`vite.config.js` con `target: 'es2015'` + `modernTargets: ['chrome 69']` + `additionalLegacyPolyfills` es una solución correcta y documentada para Chrome 61/69.

#### [FORTALEZA-2] `preloadStore.js` — código ES5 deliberado para compatibilidad con code-splitting

Uso de `var`, `function`, `IS_DEV` como constante de módulo, y `Object.keys().forEach` evita que el chunking de Vite en producción genere closures problemáticos en Chrome 61.

#### [FORTALEZA-3] `PlayerContext.jsx` — engine singleton persistente durante la sesión

El engine se crea **una sola vez** al montar el Provider y se mantiene vivo. Decisión correcta para TVs: evita pantalla negra durante navegación, pérdida del elemento `<video>`, y re-registro de listeners.

#### [FORTALEZA-4] `SamsungEngine.js` — `detectCapabilities()` protege contra diferencias de firmware

Testea la existencia de cada API antes de llamarla (`typeof api.seekTo === 'function'`), protegiendo contra diferencias entre modelos Tizen.

#### [FORTALEZA-5] `tvRemote.js` — abstracción limpia de keyCodes

Incluye los keyCodes reales de Samsung (10009) y LG (461), y maneja `e.key`, `e.code`, y `e.keyCode`/`e.which` en paralelo.

#### [FORTALEZA-6] `loginFlow.js` — activación recursiva de licencias

El flujo `loginAndActivateLicense → autoActivateLicense` con `activationRecursive` es robusto: si una licencia está en uso, intenta la siguiente antes de fallar.

#### [FORTALEZA-7] `epgWorkerClient.js` — Blob worker inline

Usar un worker inline en vez de un archivo `.worker.js` separado evita los problemas de rutas y SPA fallback en `vite preview` y producción.

#### [FORTALEZA-8] `main.jsx` — IIFE de foco global con bandera de doble registro

El sistema de `.focused` con `window.__tvFocusWired` es elegante y evita duplicar lógica de foco por pantalla.

#### [FORTALEZA-9] `panaccessService.normalizePlaybackUrl`

Reemplaza el `sessionId` en URLs ya construidas antes de reproducir, evitando el bug clásico de "URL con sesión vieja" al reactivar sesión.

#### [FORTALEZA-10] Arquitectura multi-marca con `brands.js` + `VITE_BRAND`

Permite builds independientes por operador sin modificar código fuente. El sistema de feature flags (`features.profiles`, `features.vod`, etc.) permite habilitar/deshabilitar funcionalidades por marca.

---

## 5. Plan de Mejoras

---

### Propuesta A — Correcciones Inmediatas

**Objetivo:** Resolver los bugs críticos sin refactors estructurales.  
**Esfuerzo estimado:** 1–3 días  
**Riesgo:** Bajo

---

#### A.1 — Corregir stale closure de `currentBrand` en PlayerContext

**Archivo:** `src/contexts/PlayerContext.jsx`

Reemplazar la referencia directa a `currentBrand` dentro del `useEffect([], [])` por una ref mutable:

```javascript
// Agregar en PlayerProvider:
const brandRef = useRef(currentBrand);
useEffect(() => { brandRef.current = currentBrand; }, [currentBrand]);

// Dentro del useEffect([]) — tryRecoverAfterError:
const tryRecoverAfterError = async (err, snapshot) => {
  const brand = brandRef.current; // ref siempre actualizada
  if (!brand) return false;
  // ...
};
```

**Impacto:** La recuperación automática de errores del player funcionará correctamente en producción.

---

#### A.2 — Corregir `startDate`/`endDate` en el Worker EPG

**Archivo:** `src/workers/epgWorkerClient.js`

Enviar timestamps numéricos en vez de objetos con funciones:

```javascript
// Reemplazar:
out.push(Object.assign({}, event, {
  startDate: { valueOf: function () { return startMs; } },
  endDate:   { valueOf: function () { return endMs; } }
}));

// Por:
out.push(Object.assign({}, event, {
  startMs: startMs,
  endMs: endMs,
  startDate: startMs, // número directo, serializable
  endDate: endMs,
}));
```

Ajustar todos los consumidores que comparan `event.startDate` para usar el valor numérico.

**Impacto:** El EPG mostrará los eventos en el horario correcto.

---

#### A.3 — Corregir memory leak en recreación de engine por plataforma

**Archivo:** `src/contexts/PlayerContext.jsx`

```javascript
// Reemplazar el segundo useEffect (líneas 313-342) por:
useEffect(() => {
  if (!engineRef.current) return;
  const enginePlatform = engineRef.current.platform || 'unknown';
  if (enginePlatform !== 'unknown' && enginePlatform !== currentPlatform) {
    engineRef.current.destroy(); // destroy limpia listeners internos
    engineRef.current = null;
    // Opción más segura: forzar reload de la app en cambio de plataforma
    window.location.reload();
  } else if (engineRef.current && !engineRef.current.platform) {
    engineRef.current.platform = currentPlatform;
  }
}, [currentPlatform]);
```

**Impacto:** Elimina el memory leak de event listeners del engine.

---

#### A.4 — Reemplazar `escape()` por `encodeURIComponent` en LgEngine

**Archivo:** `src/player/engines/lg/LgEngine.js`

```javascript
// Reemplazar (líneas 271-275):
try {
  return encodeURIComponent(JSON.stringify(options)); // era: escape()
} catch {
  return encodeURIComponent('{}');
}
```

**Impacto:** Encoding correcto del `mediaOption` para webOS, especialmente con DRM.

---

#### A.5 — Remover listener `popstate` que recarga brand config en cada navegación

**Archivo:** `src/contexts/BrandContext.jsx`

```javascript
// Eliminar completamente:
const handlePopState = () => { loadBrandConfig(); };
window.addEventListener('popstate', handlePopState);
// y su cleanup:
window.removeEventListener('popstate', handlePopState);
```

El listener `storage` (para cambios desde otra pestaña) puede mantenerse.

**Impacto:** Elimina la recarga innecesaria de `brands.js` y reinicialización de `panaccessService` en cada navegación. Mejora notable del rendimiento de navegación en TV.

---

### Propuesta B — Refactor Estratégico

**Objetivo:** Mejorar rendimiento y mantenibilidad en las áreas de mayor impacto.  
**Esfuerzo estimado:** 3–5 días  
**Riesgo:** Medio — requiere testing en dispositivo real

---

#### B.1 — Catchup: requests paralelos con concurrencia controlada

**Archivo:** `src/store/preloadStore.js`

Reemplazar el `for await` secuencial por batches paralelos con concurrencia máxima de 4:

```javascript
var BATCH_SIZE = 4;
var groupsWithEvents = [];
for (var start = 0; start < groupsList.length; start += BATCH_SIZE) {
  var batch = groupsList.slice(start, start + BATCH_SIZE);
  var results = await Promise.all(batch.map(function(group) {
    return panaccessService.getCatchupEvents({
      epgStreamId: group.epgStreamId,
      enableRetry: enableRetry
    })
    .then(function(resp) { return { group: group, resp: resp }; })
    .catch(function() { return { group: group, resp: [] }; });
  }));
  // procesar results...
}
```

**Impacto:** Para 30 canales de catchup, el tiempo de carga pasa de ~30s a ~8s (mejora 4x). Los errores individuales de canal no cancelan el resto.  
**Riesgo:** Algunos backends Panaccess pueden tener rate limiting. Usar batch de 4 es un balance conservador.

---

#### B.2 — Selectores granulares para progreso de EPG en el PreloadStore

**Archivo:** `src/store/preloadStore.js` + consumidores

```javascript
// Agregar selectores específicos:
export const useEpgProgress = () => usePreloadStore(s => s.epg.progress);
export const useEpgStatus   = () => usePreloadStore(s => s.epg.status);
```

Los componentes que muestran el progreso de carga usan `useEpgProgress()` en vez de suscribirse al store completo.

**Impacto:** Los re-renders durante la carga del EPG se reducen a los componentes de progreso, evitando jank en la animación del splash en TV.

---

#### B.3 — Desacoplar validación de sesión de la navegación

**Archivos:** `src/hooks/useAuthValidator.js`, `src/App.jsx`

Mover la validación de sesión a un intervalo global único con throttle por timestamp:

```javascript
const lastValidationRef = useRef(0);
const VALIDATION_INTERVAL_MS = 5 * 60 * 1000;

// Solo validar si pasaron más de 5 min desde la última validación
const shouldValidate = Date.now() - lastValidationRef.current > VALIDATION_INTERVAL_MS;
if (shouldValidate) {
  lastValidationRef.current = Date.now();
  validate();
}
```

**Impacto:** Reduce las llamadas `loggedIn` al API de N por sesión (N = número de navegaciones) a una cada 5 minutos.

---

#### B.4 — Extraer sub-componentes de `LoginPage`

**Archivo:** `src/pages/LoginPage.jsx` → múltiples archivos

| Componente nuevo | Responsabilidad |
|---|---|
| `src/components/login/QrRegisterModal.jsx` | Modal de QR de registro |
| `src/components/login/UdidModal.jsx` | Modal de login por UDID |
| `src/components/login/SocialLoginSection.jsx` | Botones Google / Facebook |
| `src/hooks/useLoginKeyboardNav.js` | Navegación TV en el formulario |

**Impacto:** `LoginPage` pasa de 1050 a ~250 líneas. Cada pieza es testeable y mantenible de forma independiente.

---

### Propuesta C — Evolución del Proyecto

**Objetivo:** Bases para estabilidad a largo plazo, observabilidad y mantenimiento.  
**Esfuerzo estimado:** 1–3 semanas por ítem  
**Riesgo:** Bajo — son adiciones, no reemplazos

---

#### C.1 — Capa de testing para lógica crítica

**Herramienta:** Vitest (compatible con Vite, sin modificar el build)

```bash
pnpm add -D vitest @vitest/coverage-v8
```

Tests a cubrir con prioridad:
- `loginFlow.js` — mocking de `panaccessService`
- `tvDataService.js` — normalizadores `normalizeBouquetsResponse`, `filterMainBouquets`
- `tvRemote.js` — mapping keyCode → `TV_ACTION`
- `epgWorkerClient.js` — normalización de fechas (el bug del structured clone habría sido detectado aquí)
- `preloadStore.loadEPG` — con datos mock

**Impacto:** Previene regresiones en lógica de negocio crítica. Los bugs de Propuesta A habrían sido detectados antes de llegar a producción.

---

#### C.2 — Observabilidad en producción sin `console.log`

**Archivo nuevo:** `src/utils/logger.js`

```javascript
const IS_DEV = import.meta.env.DEV === true;

export const logger = {
  log:   IS_DEV ? console.log.bind(console)   : () => {},
  warn:  IS_DEV ? console.warn.bind(console)  : () => {},
  error: console.error.bind(console), // errores siempre visibles
};
```

Reemplazar todos los `console.log` en `panaccessService.js` por `logger.log`. La seguridad de credenciales no depende del proceso de build.

**Impacto:** Elimina la dependencia de Terser para ocultar logs sensibles. Enfoque más seguro y explícito.

---

#### C.3 — Health check de compatibilidad en arranque

**Archivo nuevo:** `src/utils/compatCheck.js`

```javascript
export function runCompatCheck() {
  var issues = [];
  if (typeof Promise === 'undefined')  issues.push('Promise not supported');
  if (typeof URL === 'undefined')       issues.push('URL API not supported');
  if (typeof Worker === 'undefined')    issues.push('Web Workers not supported');
  if (typeof fetch === 'undefined')     issues.push('fetch not supported');
  return issues;
}
```

Ejecutar en `main.jsx` antes de renderizar. Si hay issues críticos, mostrar un mensaje de error amigable en vez de pantalla negra.

**Impacto:** Diagnóstico rápido cuando una nueva versión de webOS o Tizen rompe algo. Facilita el soporte técnico.

---

#### C.4 — Validación de schema para `brands.js`

**Archivo:** `src/config/brandConfig.js`

```javascript
export function validateBrandConfig(config) {
  var required = ['brand', 'appName', 'drm', 'token'];
  return required.filter(function(k) { return !config[k]; });
}
```

Llamar a `validateBrandConfig` en `BrandContext.loadBrandConfig` y loguear las claves faltantes en desarrollo.

**Impacto:** Detecta errores de configuración de marca antes de que lleguen a producción, especialmente útil al agregar nuevas marcas.

---

## 6. Resumen de Prioridades

| Prioridad | Item | Esfuerzo | Impacto |
|---|---|---|---|
| 🔴 P0 | A.1 — Fix stale closure `currentBrand` | 30 min | Recovery del player funciona en producción |
| 🔴 P0 | A.2 — Fix structured clone Worker EPG | 1 h | EPG muestra horarios correctos |
| 🔴 P0 | A.5 — Remover `popstate` de BrandContext | 15 min | Elimina jank en navegación TV |
| 🔴 P1 | A.4 — `escape()` → `encodeURIComponent` | 15 min | DRM correcto en webOS |
| 🔴 P1 | A.3 — Fix memory leak engine | 1 h | Sesiones largas estables |
| ⚠️ P2 | B.1 — Catchup paralelo | 4 h | 4x más rápido en carga |
| ⚠️ P2 | C.2 — Logger centralizado | 2 h | Seguridad real de credenciales |
| ⚠️ P3 | B.3 — Validación de sesión global | 3 h | Reduce llamadas API |
| ⚠️ P3 | B.4 — Refactor LoginPage | 1 día | Mantenibilidad |
| 📋 P4 | C.1 — Testing con Vitest | 2–3 días | Prevención de regresiones |
| 📋 P4 | C.3 — Health check de compatibilidad | 4 h | Soporte y diagnóstico |
| 📋 P4 | C.4 — Validación schema brands.js | 2 h | Calidad de configuración |

---

*Documento generado el 6 de mayo de 2026. Para profundizar en cualquier hallazgo, solicitar análisis quirúrgico del módulo específico.*
