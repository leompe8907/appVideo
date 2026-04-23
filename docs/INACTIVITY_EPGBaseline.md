## Inactividad (baseline EPG) — Documentación de lógica y port a appVideo

Este documento describe **cómo funciona la lógica de inactividad** en el proyecto base **EPG** y qué puntos son relevantes para **portarla/mejorarla** en `appVideo` (SmartTV/Web).

---

## Objetivo del feature (EPG)

Cuando el usuario está reproduciendo contenido y no hay interacción durante un tiempo configurado:

1) Se muestra un **modal de advertencia** (“se detendrá por inactividad”) con countdown (gracia).
2) Si el usuario confirma “seguir viendo”, se cierra el modal y se considera actividad.
3) Si el usuario no responde y el countdown llega a 0, se ejecuta una acción de **stop** (detener el player / limpiar contenido / volver al estado “sin video”).

Esto es un patrón común en OTT/TV para:
- evitar consumo innecesario (bandwidth/DRM),
- evitar quemado (burn-in),
- cumplir políticas de operadores.

---

## Componentes clave (EPG)

### A) Fuente de configuración: `X_INACTIVITY_TIMEOUT_SEC`

La configuración se toma del clientConfig:

- **`clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC`**
- Si no existe, usa un default: `CONFIG.app.defaultInactivityTimeout`

Implementación en:
- `public/js/module/user.js`

```141:145:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\module\user.js
this.X_INACTIVITY_TIMEOUT_SEC = CONFIG.app.defaultInactivityTimeout;
if (config.device && config.device.parameters && config.device.parameters.X_INACTIVITY_TIMEOUT_SEC != null) {
  var defaultValue = this.X_INACTIVITY_TIMEOUT_SEC;
  this.X_INACTIVITY_TIMEOUT_SEC = Number(config.device.parameters.X_INACTIVITY_TIMEOUT_SEC) || defaultValue;
}
```

La lectura se hace vía:
- `User.getInactivityTime()` → devuelve `User.X_INACTIVITY_TIMEOUT_SEC`.

---

### B) Tracking de interacción: `lastInteraction`

La lógica de EPG necesita un timestamp actualizado de “última actividad”.

- `User.updateLastInteraction()` setea `User.lastInteraction`.
- `User.getLastInteraction()` lo devuelve para el cálculo del diff.

Implementación en:
- `public/js/module/user.js`

```392:399:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\module\user.js
updateLastInteraction: function() {
  this.lastInteraction = getTodayDate();
  console.log("updateLastInteraction: " + this.lastInteraction);
},
getLastInteraction: function() {
  return this.lastInteraction;
},
```

**¿Qué eventos cuentan como actividad?**

En el baseline, el punto más importante está en el framework de escenas:

- `public/js/core/module/scene.js` llama `User.updateLastInteraction()` en cada `keydown`
  si la escena está visible.

```461:469:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\core\module\scene.js
onKeyDown: function (keyCode, ev, stop) {
  if (!this.isVisible) {
    return;
  }
  User.updateLastInteraction();
  ...
}
```

Adicionalmente, en Home se setea actividad en puntos específicos (ej. al “seguir viendo”):

```210:223:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\scene\home.js
InactivityManager.appStatusAction($container, function() {
  // stop player actions
  ...
}, function () {
  // cancel dialog, continue watching
  ...
  User.updateLastInteraction();
});
```

---

### C) Detección y UI: `InactivityManager`

Archivo:
- `public/js/module/InactivityManager.js`

#### Entrada principal

`InactivityManager.appStatusAction($container, stopActions, cancelActions)`:

- Guarda `$container` y `cancelActions`.
- Sale temprano si:
  - no hay credenciales,
  - no hay licencia activada,
  - ya está mostrando el modal,
  - el timeout configurado es 0 o menor.
- Si `isTimeToShowInactivityAlert()` retorna true → ejecuta `noActivityActions(...)`

```13:19:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\module\InactivityManager.js
if (!User.hasCredentials() || !User.isLicenseActivated() || this.isShown() || User.getInactivityTime() <= 0) {
  return;
}
```

#### Cálculo del timeout

Compara (en segundos) “ahora vs lastInteraction” contra `inactivityTime`:

```40:49:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\module\InactivityManager.js
var last = User.getLastInteraction();
var inactivityTime = User.getInactivityTime();
...
return (diff >= inactivityTime);
```

#### Modal + countdown (gracia hardcodeada)

Cuando se dispara:
- Muestra modal con texto + botón continuar.
- Arranca `setInterval` cada 1s.
- Si countdown llega a 0 → `stopActions()`.

```65:86:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\module\InactivityManager.js
this.toStopSeconds = 60;
...
this.toStopInterval = setInterval(function () {
  self.toStopSeconds -= 1;
  ...
  if (self.toStopSeconds <= 0) {
    self.stopInactivityDialog(true, stopActions);
  }
}, 1000);
```

> Nota: el “60 segundos” es un **segundo umbral** (grace period) independiente de `X_INACTIVITY_TIMEOUT_SEC`.

---

### D) Scheduler: cuándo se chequea la inactividad

El baseline EPG chequea desde Home:

- En `home.js`, `actionMinute()` corre cada minuto.
- Si existe `HOME.actionsForCheckInactivity`, se ejecuta.

```200:208:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\scene\home.js
actionMinute: function () {
  ...
  if (HOME.actionsForCheckInactivity) {
    HOME.actionsForCheckInactivity();
  }
},
```

La acción concreta:
- Solo chequea si `nbPlayer.isPlaying()` y no está PlayerFallback.
- Selecciona el container correcto según fullscreen.
- Llama a `InactivityManager.appStatusAction(...)`.

```210:224:C:\Users\Leonard\Desktop\Heroku\Heroku\EPG\public\js\scene\home.js
if (nbPlayer.isPlaying() && !PlayerFallback.isShown()) {
  ...
  InactivityManager.appStatusAction($container, stopActions, cancelActions);
}
```

---

## Consideraciones de rendimiento (TV)

Impacto típico:
- **Chequeo por minuto**: casi despreciable (comparación de timestamps).
- **Modal + countdown 1s**: puede costar CPU en TVs viejas (especialmente si hay reflow/Bootstrap).

Recomendaciones:
- Reducir la frecuencia del countdown (ej. cada 2–5s) o usar `setTimeout` al final + UI menos frecuente.
- Evitar manipulación DOM pesada por tick.
- Pausar chequeos si ya hay overlays más críticos (p. ej. offline modal, parental gate).

---

## Mejoras posibles (sin romper el contrato)

Sin cambiar el contrato de entrada (`X_INACTIVITY_TIMEOUT_SEC`), se puede:

1) **Configurar también grace period**:
   - `X_INACTIVITY_GRACE_SEC` en `clientConfig.device.parameters`.
2) **Mejor scheduler**:
   - En vez de correr cada minuto, programar un `setTimeout` al momento exacto de expiry.
3) **Mejor detección de actividad**:
   - incluir pointer/mouse/scroll (MRCU) además de keydown.
4) **Histeresis**:
   - si el usuario interactúa, evitar mostrar modal inmediatamente por jitter.

---

## Idea/UX opcional: “Screensaver” con imágenes al detener por inactividad (estilo Netflix)

Cuando expira la inactividad y se ejecuta `stopActions`, es posible mostrar un **overlay full-screen** tipo “screensaver” que rote imágenes (similar a Netflix/Prime).

### Objetivos del screensaver

- Evitar dejar la app en una pantalla estática (burn-in).
- Mantener una experiencia premium/OTT.
- No reanudar playback automáticamente por defecto (esto depende de la política del producto).

### Fuentes de imágenes disponibles en `appVideo`

En `appVideo` la app ya precarga metadata:

- **VOD**: `usePreloadStore().vod` contiene `allVods`, `vodRecommended` y categorías.
  - Ideal: usar **backgrounds/posters**.
- **EPG/Canales**: `usePreloadStore().epg.streams` trae canales con logos (`img`, `logoUrl`, etc.).
  - Útil como fallback si no hay VOD/catchup.

En todos los casos, lo que se tiene es **metadata + URLs**, no necesariamente bytes cacheados.
Por eso se recomienda:
- seleccionar pocas imágenes (ej. 5–10),
- **precargar 2–3** con `new Image().src = ...` para evitar parpadeos,
- rotar cada 5–10s con transiciones simples (fade).

### Caso borde: no hay VOD/catchup y EPG tiene imágenes rotas

Sí: es **recomendable** tener un “último recurso” (backup) para no mostrar un screensaver vacío.

Estrategia recomendada (en orden):

1) **VOD recomendado** (`vod.vodRecommended`) → backgrounds/posters.
2) **VOD general** (`vod.allVods`) → sample aleatorio.
3) **EPG streams** (`epg.streams`) → logos de canales.
4) **Assets de marca** (siempre presentes):
   - `public/<brand>/background.png`
   - `public/<brand>/logo.png`
   - `public/<brand>/splash.png`
5) **Shared fallback**:
   - `public/shared/screensaver-1.jpg`, `screensaver-2.jpg`, etc. (paquete mínimo de 3–5 imágenes).
6) **Fallback final (sin imágenes)**:
   - gradiente + logo + reloj (0 KB extra, 0 dependencias de red).

Con esto, aunque el catálogo esté vacío o el CDN falle, el usuario verá un screensaver consistente.

### Consideraciones SmartTV (rendimiento)

- Evitar animaciones complejas; preferir **fade**.
- No precargar muchas imágenes (memoria).
- No rotar muy rápido; 8–12s suele verse “OTT-like”.
- Al primer `keydown/pointerdown`, cerrar screensaver y registrar actividad.

---

## Port a `appVideo` (mapa recomendado)

### Fuente del timeout

En `appVideo`, la config equivalente suele venir de `userSession.getClientConfig()` (persistida desde `panaccessService.getClientConfig()`).
La clave a buscar/portar:
- `clientConfig.device.parameters.X_INACTIVITY_TIMEOUT_SEC`

### Actividad del usuario

El equivalente de `User.updateLastInteraction()` sería:
- un store global (`zustand`) o un ref global que capture:
  - `keydown` (con capture true para TVs),
  - `pointerdown`,
  - `mousemove` (solo PC),
  - cualquier acción del remote/spatial navigation.

### Scheduler

Opciones:
- **Baseline** (paridad EPG): verificar cada 60s mientras haya playback.
- **Mejorado**: timer al “deadline” exacto (más eficiente y reactivo).

### UI modal

En `appVideo` ya existe infraestructura de overlays/modales (`ConfirmModal`, overlays custom). Recomendación:
- usar un modal dedicado “Inactivity” con countdown y botón “Seguir viendo”.

### Acciones

- `stopActions`: cerrar/reiniciar playback (`player.close()` o `player.stop()` + navegar a home).
- `cancelActions`: cerrar modal y mantener reproducción.

---

## Checklist de aceptación (port)

- Timeout configurado se respeta (`X_INACTIVITY_TIMEOUT_SEC`).
- Interacción de remote (flechas/enter/back) resetea actividad.
- Modal aparece solo si hay playback y el usuario está inactivo.
- Countdown se muestra y al llegar a 0 detiene reproducción.
- “Seguir viendo” cierra modal y la reproducción continúa.

