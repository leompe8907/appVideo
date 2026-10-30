## Perfiles externos — flujo, reglas y puntos de integración

Este documento describe los **perfiles del backend externo de la marca** en `appVideo` (web, Smart TV y Vega/Fire TV) y su equivalente en la app Android: qué ve el usuario, qué reglas deciden cada paso, qué se guarda en el dispositivo, qué archivos lo componen y qué queda pendiente.

> Hoy solo la marca `wind` usa perfiles externos, contra el backend de Wind (`backend.wind.do`, repo `panaccess_wind_integration`). El contrato de la API está en ese repo: `docs/IMPLEMENTACION_PERFILES_WIND_2026-10-15.md`.

---

## 1. Resumen funcional

- Cada perfil es una ficha del backend (nombre, avatar, infantil, edad máxima, PIN propio) que lleva **una licencia de streaming** de la cuenta. El tope de perfiles es la cantidad de licencias.
- Para reproducir, la app activa la licencia del perfil con `setStreamingLicense`, **como siempre**: PanAccess sigue siendo quien impide dos reproducciones sobre la misma licencia. Las funciones de perfiles de PanAccess **no se usan**.
- Si la licencia del perfil está en uso en otro dispositivo, el perfil puede usar una licencia **libre** (sin asignar a ningún perfil) como **préstamo**. Así, una cuenta con 4 licencias y un solo perfil sigue teniendo 4 pantallas.
- El **PIN del perfil** lo elige el usuario (4 a 6 dígitos) y lo verifica el servidor (5 fallos bloquean el perfil 15 minutos). **No es el PIN de la tarjeta**, que sigue siendo un secreto entre la app y PanAccess.
- Favoritos y control parental se guardan **por perfil** (`profileKey` = id del perfil).

Principios:

- **Comportamiento de mercado** (Netflix, Disney+, Max, Prime Video): con varios perfiles, "¿Quién está viendo?" aparece **cada vez que se abre la app**; con uno solo sin PIN, se entra directo.
- **Nada cambia para quien no usa perfiles**: otras marcas (`profilesSource: "panaccess"`) y cuentas sin perfiles en el backend (`profiles_disabled`) siguen exactamente como antes.
- **Lo guardado en el dispositivo no se usa a ciegas**: al abrir la app se vuelve a pedir la selección al backend (el perfil pudo borrarse o su licencia pasar a otro perfil).

---

## 2. Flujo del usuario

### 2.1 Iniciar sesión o abrir la app

| Situación | Qué ve el usuario |
|---|---|
| La cuenta tiene **un solo perfil sin PIN** | Entra directo al inicio |
| La cuenta tiene **un solo perfil con PIN** | "¿Quién está viendo?" y el PIN |
| La cuenta tiene **varios perfiles** | **Siempre** "¿Quién está viendo?", aunque el último usado no tenga PIN |
| La cuenta **no tiene perfiles** en el backend (`profiles_disabled`), o no hay sesión con el backend | Lo de antes: inicio si hay licencia activa, si no elegir tarjeta |

La primera vez que una cuenta consulta sus perfiles, el backend le crea uno solo, **"Principal"**, con la primera licencia. Por eso una cuenta recién encendida entra directo, y crear perfiles se hace desde **Mi cuenta → Cambiar perfil**.

### 2.2 Elegir un perfil

1. Si el perfil tiene PIN, se pide. PIN incorrecto: se puede reintentar. 5 fallos: "Demasiados intentos" por 15 minutos.
2. La app pide al backend las **licencias candidatas** en orden: la del perfil, la que este dispositivo ya tenga prestada, las libres y al final las prestadas a otro.
3. Las prueba una por una con `setStreamingLicense(failIfInUse: true)`. La primera que funciona se **confirma** al backend (`select/confirm/`) y queda guardada como la licencia del perfil en este dispositivo.
4. Se sincronizan los favoritos y el control parental de **ese** perfil, y se va al inicio.

Casos especiales:

| Caso | Qué ve el usuario |
|---|---|
| Todas las licencias en uso | "**Perfil en uso**: X se está viendo en *TV Sala* y no quedan pantallas libres. Si continúas aquí, se detendrá allá." → **Continuar aquí** toma la licencia **propia** del perfil (nunca la de otro perfil) y corta la otra pantalla |
| La cuenta todavía no tiene licencias sincronizadas | Elegir tarjeta, como antes de los perfiles |
| No se pudieron cargar los perfiles | Mensaje con **Reintentar** y **Continuar sin perfil** |

### 2.3 Dentro de la app

| Acción | Dónde / qué pasa |
|---|---|
| Cambiar de perfil | **Mi cuenta → Cambiar perfil** (solo si la cuenta tiene un perfil activo). Siempre muestra la lista |
| Contenido por encima de la edad del perfil | No se reproduce y **no se desbloquea con ningún PIN**: "No disponible en este perfil". En la web, con **Cambiar perfil**; en Vega, con **Cerrar** (el cambio se hace desde Mi cuenta) |
| Dispositivos vinculados | Cada dispositivo muestra el perfil que está usando |

### 2.4 Administrar perfiles (en "¿Quién está viendo?")

- **Agregar perfil** (si quedan cupos): nombre, avatar, infantil, "contenido permitido hasta" (Sin límite, L, 10, 12, 14, 16, 18) y PIN opcional. Un perfil infantil sin edad queda en 10.
- **Editar**: lo mismo, más cambiar o quitar el PIN. Un perfil con PIN pide su PIN para editarse o borrarse.
- **Eliminar**: libera la licencia para otro perfil y borra sus preferencias. El perfil principal no se puede borrar.
- **Olvidé el PIN**: la contraseña de la cuenta lo quita o pone uno nuevo.

---

## 3. Comparación con el mercado

| Comportamiento | appVideo / Vega / Android | Netflix, Disney+, Max, Prime |
|---|---|---|
| Un solo perfil sin PIN | Entra directo | Entra directo |
| Varios perfiles al abrir la app | Lista siempre | Lista siempre |
| PIN por perfil | Opcional, verificado en el servidor, restablecible con la contraseña de la cuenta | Igual |
| Mismo perfil en dos pantallas | Préstamo de licencia libre; sin libres, "Continuar aquí" | Hasta el límite de pantallas del plan |
| Contenido por edad | Se bloquea al reproducir | No se muestra en el catálogo del perfil |
| Salida del perfil infantil | Libre: la protegen los PIN de los perfiles de adultos | Igual (Disney+ además tiene salida a prueba de niños) |

Recomendación al usuario: **poner PIN a los perfiles de adultos** si hay perfiles infantiles.

---

## 4. Configuración

### 4.1 En la marca (`packages/core/src/config/brands/<marca>.js`)

```js
"features": {
  "profiles": true,             // la marca tiene perfiles
  "profilesSource": "externo",  // "panaccess" (por defecto) | "externo"
}
```

- `"externo"` solo aplica con `"profiles": true` y requiere `login.deviceSession` (el JWT del backend externo).
- Todas las marcas declaran `profilesSource`; solo `wind` usa `"externo"`. **Una marca nueva debe declarar `"panaccess"`** (ver `defaults.js` y la documentación en `brands.js`).

### 4.2 En el backend de Wind (`.env` del servidor)

| Variable | Efecto |
|---|---|
| `PROFILES_ENABLED=true` | Perfiles para todas las cuentas |
| `PROFILES_ENABLED_FOR=COD1,COD2` | Piloto: perfiles solo para esos códigos de abonado (con `PROFILES_ENABLED` apagado) |

Sin perfiles para la cuenta, la API responde `404 profiles_disabled` y la app sigue como antes. **Encender `PROFILES_ENABLED` para todos recién cuando las apps estén publicadas**: una app vieja usa `profileKey=default` y activa "la primera licencia libre", que puede ser la de un perfil.

---

## 5. Reglas en código

Las decisiones viven en `@appvideo/core` para que web y Vega decidan igual:

| Regla | Dónde |
|---|---|
| ¿La marca usa perfiles externos? | `utils/navigation.js` → `usesExternalProfiles` |
| Después del login / al abrir la app, ir a `/profile` | `utils/navigation.js` → `resolvePostLoginRoute` |
| ¿A qué perfil se entra solo? (único y sin PIN) | `utils/externalProfiles.js` → `pickAutoEnterProfile` |
| Ruta sin perfiles (inicio o elegir tarjeta) | `utils/externalProfiles.js` → `routeWithoutProfiles` |
| Qué hacer con el resultado de entrar | `utils/externalProfiles.js` → `nextStepAfterEnter` |
| Mensaje de cada error del backend | `utils/externalProfiles.js` → `profileErrorMessageKey` |
| Validar y armar el formulario de perfil | `utils/externalProfiles.js` → `validateProfileForm`, `buildProfilePayload`, `maxAgeAfterKidsToggle` |
| ¿Mostrar "Cambiar perfil"? | `utils/externalProfiles.js` → `canChangeProfile` |
| Bloqueo por edad (sin PIN) | `store/parentalGateStore.js` → `exceedsProfileAge`, `requestProfileAgeBlock` |

---

## 6. Mapa de archivos

```
packages/core/src/
  services/externalProfilesService.js   API /api/v1/profiles/ (con el JWT de deviceAuthService)
  services/externalProfileSession.js    entrar al perfil: candidatas, setStreamingLicense, confirmar, guardar
  services/loginFlow.js                 waitForDeviceSessionAuth, activateLicense, getLicensesWithPins
  services/preferencesSyncService.js    profileKey = id del perfil activo
  store/activeProfileStore.js           perfil activo + su licencia (source: 'externo')
  store/parentalGateStore.js            gateKind 'profileAge'
  utils/externalProfiles.js             decisiones compartidas web/Vega (con tests)
  utils/navigation.js                   usesExternalProfiles, resolvePostLoginRoute
src/
  pages/ExternalProfilePage.jsx         "¿Quién está viendo?" (web / Smart TV)
  components/Profile/ExternalProfileFormModal.jsx
  components/parental/ParentalGateHost.jsx   aviso "No disponible en este perfil"
  components/account/LinkedDevicesPanel.jsx  perfil de cada dispositivo
  pages/MiCuentaPage.jsx                "Cambiar perfil"
  styles/pages/_external-profile.scss
apps/vega/src/
  screens/ProfileScreen.jsx             "¿Quién está viendo?" (Fire TV)
  profile/ProfileFormModal.jsx, profile/ResetPinModal.jsx
  routes.js                             '/profile' → pantalla 'profile' con perfiles externos
```

Los perfiles de PanAccess (`src/pages/ProfilePage.jsx` y sus modales) siguen existiendo para `profilesSource: "panaccess"`; ninguna marca los tiene encendidos.

---

## 7. Qué se guarda en el dispositivo

Todo con el prefijo de la marca; se borra al cerrar sesión.

| Clave | Contenido |
|---|---|
| `activeProfile.v1` | `id`, `name`, `imageId` (avatar), `source: 'externo'`, `maxAge`, `isKids`, `hasPin`, `licenseSn`, `loan` |
| `license` / `licensePin` | La licencia que consiguió el perfil (la usan el reproductor y la recuperación de sesión) |
| `deviceSession.*` | JWT del backend y `device_token` del dispositivo (ya existían) |

El PIN del perfil **nunca** se guarda.

---

## 8. Errores del backend que la app trata

| `code` | Cuándo | Qué hace la app |
|---|---|---|
| `profiles_disabled` | La cuenta no tiene perfiles | Sigue sin perfiles |
| `pin_incorrect` | PIN mal | "PIN incorrecto", deja reintentar |
| `pin_locked` | 5 fallos | "Demasiados intentos" |
| `name_taken` | Nombre repetido | Mensaje en el formulario |
| `no_free_license` | Sin cupos | "Tu plan no permite más perfiles" |
| `owner_profile` | Borrar el principal | Mensaje |
| `current_password_incorrect` | "Olvidé el PIN" con contraseña mal | Mensaje |
| `profile_not_found` | El perfil se borró en otro dispositivo | Mensaje genérico ("No se pudo entrar al perfil"); la lista se actualiza al volver a abrirla |

---

## 9. Android (`androidpanaccessapp`)

Mismo flujo y mismas reglas, con la bandera `BuildConfig.PROFILES_SOURCE` (`"panaccess"` por defecto, `"externo"` solo en `wind_mobile`):

- `profiles/ExternalProfiles.kt` (bandera, perfil activo, edad), `profiles/ExternalProfileSession.kt` (entrar al perfil), `presentation/viewmodel/ExternalProfilesViewModel.kt` y `presentation/ui/profiles/ExternalProfilesScreen.kt`.
- Al abrir la app con la sesión iniciada pasa siempre por "¿Quién está viendo?" (si la cuenta ya respondió `profiles_disabled`, no vuelve a preguntar en 24 h).
- El bloqueo por edad está en `VideoFragment.isProtected`; "Cambiar perfil" en Cuenta; la recuperación de sesión (`LicenseHelper`) reactiva la licencia del perfil.
- Los avatares se dibujan como un color con la inicial, con los mismos ids (87-95) que la web.

---

## 10. Pendientes

- **Límite diario** (`dailyLimitMinutes`): el backend lo guarda y cuenta los minutos (`usage/`), pero ninguna app corta la reproducción.
- **Filtrar el catálogo por edad**: hoy se bloquea al reproducir; el mercado no muestra ese contenido.
- **iOS**: sin perfiles.
- **Informe para padres** y **perfiles extra como producto**: decisiones del backend pendientes.
