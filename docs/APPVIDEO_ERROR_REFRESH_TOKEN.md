# appVideo: la sesión del backend de Wind se pierde al refrescar el token

Reporte del equipo de apps (Android e iOS) al equipo web. Fecha: 25/09/2026.

Lo encontramos al estudiar cómo appVideo integra el backend de Wind, para replicarlo en las apps nativas. Rama `navigate`, commit `1d91a27` (17/09), archivo `src/services/deviceAuthService.js`.

## Resumen

Hay dos problemas en el refresco del token de acceso. Los dos terminan igual: **se borra la sesión del backend de Wind aunque el usuario no hizo nada mal**, y dejan de funcionar las funciones que dependen de ella (dispositivos vinculados, cambio de contraseña, eliminar cuenta, preferencias, "Más vistos") hasta que se vuelve a crear la sesión.

1. **Dos refrescos al mismo tiempo:** si dos pedidos reciben un 401 casi juntos, los dos refrescan con el mismo token de refresco; el segundo usa uno que el backend ya anuló y appVideo borra la sesión, incluidos los tokens buenos que acaba de guardar el primero.
2. **Un error de red borra la sesión:** si el refresco falla por falta de conexión o un corte momentáneo, appVideo la trata igual que un token vencido y borra la sesión.

## Contexto: el backend rota el token de refresco

El backend tiene `ROTATE_REFRESH_TOKENS = True` y `BLACKLIST_AFTER_ROTATION = True` (`panaccess_wind_integration/settings.py:236-237`). Cada vez que se usa el token de refresco, el backend entrega uno nuevo y **anula el anterior**. El token de acceso dura 15 minutos.

appVideo ya guarda el token rotado (líneas 172-174, corregido antes); eso está bien.

## Problema 1: dos refrescos al mismo tiempo

### Dónde

- `authorizedDeviceRequest` (líneas 212-243): ante un 401, cada pedido llama por su cuenta a `refreshDeviceSessionAccessToken` (línea 235) y reintenta.
- `refreshDeviceSessionAccessToken` (líneas 148-183): no hay nada que evite que dos llamadas corran a la vez.
- `mostWatchedChannelsService.js` hace lo mismo por su lado (reintento tras refrescar si recibe 401).

### Cómo falla

1. Vence el token de acceso.
2. Dos pedidos salen casi juntos. Pasa sobre todo al volver a la app o al abrir "Mi cuenta": coinciden la lectura de preferencias, la lista de dispositivos, "Más vistos", etc.
3. Los dos reciben 401 y los dos llaman a `refreshDeviceSessionAccessToken` con el **mismo** token de refresco guardado.
4. El primero gana: recibe `access` y `refresh` nuevos y los guarda. El backend anula el token viejo.
5. El segundo llega con el token viejo, ya anulado. El backend responde 401 (`token_not_valid`).
6. `parseJsonResponse` lanza el error y cae en el `catch` (líneas 177-181), que llama a `clearDeviceSessionAuth(brand)` y **borra la sesión entera**, incluidos los tokens válidos que acaba de guardar el primer pedido.

Es intermitente: sólo pasa si dos pedidos coinciden justo después de vencer el token. Por eso es difícil de reproducir y de relacionar con un síntoma.

**Varias pestañas:** los tokens están en `localStorage`, que comparten todas las pestañas del mismo sitio. Dos pestañas abiertas pueden chocar igual, aunque cada una refresque de a uno.

## Problema 2: un error de red borra la sesión

El `catch` de las líneas 177-181 atrapa **cualquier** error: tanto el rechazo del backend (token vencido o anulado, que sí justifica borrar la sesión) como un `fetch` que falla por red (sin conexión, corte, timeout). En el segundo caso la sesión sigue siendo válida en el servidor, pero appVideo la borra igual. En una TV o una computadora con conexión inestable, esto hace perder la sesión sin motivo.

## Cómo corregirlo

### 1. Un solo refresco a la vez

Compartir la promesa del refresco en curso: si ya hay uno, los demás la esperan en vez de lanzar otro.

```js
let refreshInFlight = null;

export function refreshDeviceSessionAccessToken(brandConfig, brand) {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshDeviceSessionAccessToken(brandConfig, brand)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
```

(`doRefreshDeviceSessionAccessToken` es la función actual, con el cambio del punto 3.)

### 2. No refrescar si otro ya lo hizo

En `authorizedDeviceRequest`, ante un 401, comparar el token guardado con el que se usó. Si cambió, otro pedido ya refrescó mientras éste estaba en vuelo: reintentar con ese, sin refrescar de nuevo.

```js
let res = await doFetch(accessToken);
if (res.status === 401) {
  const current = getDeviceSessionAccessToken(brand);
  const refreshed = current && current !== accessToken
    ? current
    : await refreshDeviceSessionAccessToken(brandConfig, brand);
  if (refreshed) {
    accessToken = refreshed;
    res = await doFetch(accessToken);
  }
}
```

Lo mismo en `mostWatchedChannelsService.js`, o mejor: que use `authorizedDeviceRequest` en vez de su propio reintento.

### 3. Borrar la sesión sólo si el backend rechaza el token

Distinguir el rechazo (HTTP 400 o 401 del endpoint de refresco) de un error de red. Sólo en el primer caso se borra la sesión; con un error de red se devuelve `''` sin tocar nada, y el próximo pedido lo reintenta.

```js
async function doRefreshDeviceSessionAccessToken(brandConfig, brand) {
  const base = resolveDeviceAuthBaseUrl(brandConfig);
  const refresh = getDeviceSessionRefreshToken(brand);
  if (!base || !refresh) return '';

  let res;
  try {
    res = await fetch(`${base}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    return ''; // sin red: la sesión sigue siendo válida, no se borra
  }

  if (res.status === 400 || res.status === 401) {
    clearDeviceSessionAuth(brand); // token vencido o anulado: la sesión terminó
    return '';
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access) return '';

  const id = resolveBrandId(brand);
  setBrandItem(id, STORAGE_KEYS.access, data.access);
  if (data.refresh) setBrandItem(id, STORAGE_KEYS.refresh, data.refresh);
  return data.access;
}
```

### 4. Opcional: varias pestañas

Para que dos pestañas no refresquen a la vez, envolver el refresco en la Web Locks API (`navigator.locks.request('wind-refresh', …)`) y, dentro del lock, volver a leer el token de `localStorage` antes de refrescar (si otra pestaña ya lo hizo, usar ése). Las TV (Tizen, webOS) corren una sola instancia, así que esto sólo aplica a la versión web.

## Cómo probarlo

1. Iniciar sesión y esperar a que venza el token de acceso (más de 15 minutos), o borrar a mano `wind.deviceSession.access` en `localStorage`.
2. Disparar dos pedidos autenticados a la vez, por ejemplo desde la consola:
   `Promise.all([authorizedDeviceRequest(cfg, 'wind', '/wind/devices/'), authorizedDeviceRequest(cfg, 'wind', '/api/v1/preferences/?profileKey=default')])`.
3. **Hoy:** en la pestaña Red se ven dos `POST /api/auth/token/refresh/`, el segundo con 401, y `wind.deviceSession.*` desaparece de `localStorage`.
4. **Corregido:** un solo `POST /api/auth/token/refresh/`, los dos pedidos responden bien y los tokens siguen guardados.
5. Error de red: con la sesión vencida, cortar la red (modo avión o "Offline" en las herramientas del navegador), disparar un pedido y volver a conectar. **Hoy** la sesión desaparece; **corregido** sigue y el siguiente pedido refresca bien.

## En las apps nativas

Android e iOS ya tienen las tres correcciones: un solo refresco a la vez (`Mutex` en Kotlin, una tarea compartida en Swift), no refrescar si otro ya lo hizo, y borrar la sesión sólo si el backend rechaza el token. Ver `refreshAccessToken` en `WindAccountRepositoryImpl.kt` (Android) y en `WindAccountService.swift` (iOS).
