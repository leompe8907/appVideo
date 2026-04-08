# Plan de implementación — Bloqueo/Desbloqueo de Canales (Opción A: bloqueo de acceso)

## Objetivo
Implementar una funcionalidad de **control parental** que permita **bloquear/desbloquear canales** sin ocultarlos del listado (Bouquet/EPG/Buscador), pero **bloqueando el acceso a la reproducción** cuando el canal esté marcado como bloqueado.

La UX es TV-first: el canal sigue siendo navegable con D-Pad, pero al presionar **Enter/OK** se muestra un **gate** (overlay/modal) solicitando **PIN** para permitir el playback.

## Alcance del MVP (Iteración 1)
- Área de configuración para:
  - Activar/desactivar control parental.
  - Configurar/cambiar PIN.
  - Bloquear/desbloquear canales desde una lista.
- Gate de PIN cuando el usuario intenta reproducir un canal bloqueado.
- Persistencia local (localStorage) versionada.
- Integración mínima en los puntos de “play” (Bouquet/EPG/otros entrypoints de reproducción).

## No alcance (por ahora)
- Ocultar canales bloqueados (esa es la opción B; **NO** se implementa en A).
- Bloqueos por rating/edad (VOD parental by rating).
- Multi-perfil avanzado (si existen perfiles, se deja preparado para iteración futura).
- Límites de intentos/cooldowns (se documenta como regla futura).
- Sincronización con backend (se documenta como iteración futura).

---

## Principios / Reglas de producto (Opción A)

### Reglas principales
- **R1 — Canal visible siempre**: un canal bloqueado se sigue mostrando en grillas (Bouquet/EPG/Search).
- **R2 — Bloqueo solo en la acción**: el bloqueo se aplica **al intentar reproducir** o “entrar” a un detalle que dispare reproducción.
- **R3 — Un solo punto de enforcement**: la validación se centraliza en una capa (hook/servicio) para evitar duplicar lógica en múltiples páginas.
- **R4 — Desbloqueo temporal** (recomendado, se puede activar desde el inicio o en iteración 2):
  - Un PIN correcto habilita playback para ese canal (o para todos) durante un tiempo configurable.
- **R5 — Back/Return**:
  - Si el gate está abierto, Back/Return lo cierra y restaura el foco al elemento previo.

### Condiciones para gate
Se muestra gate si y solo si:
- Control parental está **habilitado** (`enabled === true`) AND
- El canal está marcado como **bloqueado** AND
- No hay un desbloqueo vigente (por sesión/tiempo).

---

## Arquitectura propuesta (capas)

### 1) Store de Control Parental (Zustand)
Se propone un store dedicado (ej. `src/stores/parentalStore.js`) con:

**Estado mínimo**
- `enabled: boolean`
- `pinHash: string | null` (no guardar PIN plano)
- `pinSalt: string | null` (si se implementa hashing con salt)
- `blockedChannelIds: string[]` (o `Record<string, true>`; ver “Modelo de datos”)
- `unlockUntilMs: number | null` (timestamp; null = no desbloqueado)
- `lastUnlockScope: 'global' | 'channel' | null` (opcional)
- `lastUnlockedChannelId: string | null` (si el scope es por canal)

**Acciones**
- `setEnabled(boolean)`
- `setPin(pin: string)` / `changePin(oldPin, newPin)`
- `blockChannel(channelId: string)`
- `unblockChannel(channelId: string)`
- `toggleBlock(channelId: string)`
- `isChannelBlocked(channelId: string): boolean`
- `isUnlockedFor(channelId: string): boolean` (considera unlock temporal/scope)
- `unlockWithPin(pin: string, { scope, channelId, ttlMs }): boolean`
- `lockNow()` (cierra desbloqueo)
- `hydrateFromStorage()` + `persistToStorage()` (o middleware persist)

**Recomendación de persist**
Usar persistencia con un schema versionado (ver sección “Persistencia”).

### 2) Gate API (hook/servicio) para centralizar enforcement
Crear un hook (ej. `useParentalGate`) o un servicio (ej. `parentalGate`) para que los entrypoints de reproducción no implementen lógica propia.

**Contrato sugerido**
- `requestPlayChannel({ channel, playFn })`
  - Internamente decide:
    - si abre gate de PIN
    - o llama a `playFn()` (que termina en `usePlayer().play(...)`)

Esto permite que:
- Bouquet/EPG/Search solo llamen a `requestPlayChannel(...)`
- El gate mantenga su propia UI + manejo de foco.

### 3) UI del Gate (modal/overlay)
Un componente reutilizable (ej. `ParentalPinGate`) que:
- Recibe:
  - `isOpen`
  - `channel`
  - `onSuccess`
  - `onCancel`
- Implementa:
  - Input PIN (4–6 dígitos)
  - Mensaje de error
  - Botones “Aceptar” / “Cancelar”
  - Integración con navegación espacial (focus trap o grupo)
  - Soporte a Back/Return para cerrar

---

## Modelo de datos y normalización de canal

### ChannelId estable
Es crítico usar un identificador estable para el bloqueo:
- Preferir `serviceId` / `channelId` del backend (EPG/TV services).
- Evitar índices o nombres (cambian entre marcas/lineups).

**Estrategia de normalización**
Definir una función utilitaria:
- `getChannelStableId(channel): string`
  - Usa el campo más estable disponible (ej. `channel.serviceId` o `channel.id`)

### Namespace por marca
Dado que el proyecto es multi-brand (builds por `VITE_BRAND`), el storage debe estar namespaced:
- Ej. `parental.v1.<brand>`

Esto evita colisiones cuando la misma TV prueba múltiples marcas.

---

## Persistencia (localStorage) — schema versionado

### Clave
- `parental.v1.<brand>` (brand obtenido desde `BrandContext`/config activa)

### Estructura sugerida (v1)
```json
{
  "version": 1,
  "enabled": true,
  "pinHash": "base64/hex",
  "pinSalt": "base64/hex",
  "blockedChannelIds": ["123", "456"],
  "unlockUntilMs": 1710000000000,
  "lastUnlockScope": "global"
}
```

### Notas de seguridad
- No es un sistema “anti-tamper” (localStorage se puede borrar), pero sí evita exposición del PIN.
- Para el hashing:
  - Recomendado: **WebCrypto PBKDF2** (con salt aleatorio + iteraciones).
  - MVP pragmático: SHA-256 + salt (si se necesita rapidez).

---

## Flujos UX detallados (TV-first)

### Flujo F1 — Bloquear/desbloquear desde configuración
1. Usuario entra a “Control parental”.
2. Activa `enabled`.
3. Si no hay PIN configurado:
   - Se solicita “Crear PIN”.
4. Usuario navega lista de canales:
   - Enter en un canal alterna `Bloqueado/Permitido`.
5. Visual:
   - Badge “Bloqueado” y/o icono `🔒` en la fila del canal.

### Flujo F2 — Intentar reproducir canal bloqueado
1. Usuario enfoca un canal bloqueado en Bouquet/EPG.
2. Presiona Enter/OK.
3. Se abre gate de PIN:
   - foco inicial en input/teclado del PIN.
4. Usuario ingresa PIN:
   - PIN correcto:
     - Se setea `unlockUntilMs = now + ttlMs`.
     - Se llama a `playFn()` (reproducción).
   - PIN incorrecto:
     - Se muestra error y se mantiene el gate.
5. Cancel/Back:
   - cierra gate y se restaura foco al canal.

### Flujo F3 — Desbloqueo temporal y expiración
- Mientras `Date.now() < unlockUntilMs`, no se pide PIN (según scope).
- Al expirar, vuelve a requerir PIN.

**TTL sugerido (default)**
- 15 minutos (equilibrio entre fricción y seguridad).
En iteraciones futuras se hace configurable.

---

## Scope del desbloqueo (recomendación)

### Opción recomendada para TV (MVP)
- **Scope global temporal**: un PIN desbloquea “reproducción de canales bloqueados” durante \(TTL\).
  - Pros: reduce fricción en zapping / navegación.
  - Contras: es menos restrictivo que por canal.

### Alternativa (Iteración futura)
- **Scope por canal**: desbloqueo aplica solo al canal intentado.
- **Scope por sesión**: desbloquea hasta cerrar app / recargar.

Se recomienda implementar el store con campos suficientes para soportar ambos sin refactor agresivo.

---

## Puntos de integración (enforcement)

### Regla: centralizar
No es recomendable poner “if blocked” en cada page.

**Puntos típicos donde disparar `requestPlayChannel`**
- Bouquet: cuando se presiona Enter sobre un canal o se ejecuta “Play”.
- EPG: cuando se selecciona un programa/canal que dispara playback.
- Search: cuando se elige un resultado tipo canal.
- Cualquier atajo de “Reproducir ahora”.

### Integración con PlayerContext
La reproducción actual pasa por `usePlayer().play({ type, id, url, ... })`.
El gate debe decidir si se llama o no; el player no debe “saber” del bloqueo.

---

## Manejo de foco y accesibilidad TV

### Reglas de foco en overlay
- Al abrir gate:
  - foco entra al input del PIN o primer botón.
- Al cerrar gate:
  - foco vuelve al elemento que disparó el gate (guardar “lastFocusedKey”).

### Teclas relevantes
- Enter/OK: confirmar
- Back/Return: cancelar/cerrar
- Flechas: navegar entre teclado numérico/botones

El proyecto ya usa `@noriginmedia/norigin-spatial-navigation`; el gate debe integrarse como un “focus boundary”.

---

## Estados y mensajes UX

### Estados UI
- `enabled=false`: todo funciona normal, no hay gate.
- `enabled=true` y `pinHash=null`: forzar configuración de PIN (bloqueo no debería operar sin PIN).
- `enabled=true` y canal bloqueado:
  - gate visible al intentar play.

### Mensajes
- “Canal bloqueado”
- “Ingrese PIN para continuar”
- “PIN incorrecto”
- “PIN creado/actualizado” (toast/feedback)

---

## Casos borde (documentados para iteraciones)

- **E1 — Intentos fallidos**:
  - Regla futura: 3 intentos fallidos → cooldown 30–60s.
- **E2 — Reinicio / pérdida de storage**:
  - Si se borra storage, el control parental vuelve a estado default.
- **E3 — Multi-brand**:
  - Namespace por marca (ya contemplado).
- **E4 — Catchup/VOD ligado a canal**:
  - Política futura: si el canal está bloqueado, su catchup también.
- **E5 — Sin canalId confiable**:
  - Definir fallback: bloquear por `serviceId` o `lcn` + `providerId` si aplica.

---

## Roadmap sugerido (iteraciones)

### Iteración 1 (MVP)
- Store parental + persist v1.
- Pantalla de configuración + lista de canales.
- Gate PIN + enforcement en play.
- Unlock temporal global (TTL fijo).

### Iteración 2
- TTL configurable desde settings.
- Scope configurable (global vs canal).
- Cooldown por intentos fallidos.
- Mejoras de UX (teclado numérico dedicado, animaciones livianas TV-safe).

### Iteración 3
- Persistencia server-side por cuenta/perfil.
- Políticas por rating (VOD).
- Auditoría/telemetría (eventos: gate-open, unlock-success, unlock-fail).

---

## Criterios de aceptación (QA)
Basado en la matriz de SmartTV:
- Siempre hay foco visible en gate y al cerrar se restaura correctamente.
- Canal bloqueado:
  - Enter abre gate y **no** inicia playback sin PIN.
  - PIN correcto inicia playback y no vuelve a pedirlo dentro del TTL.
  - PIN incorrecto no inicia playback.
- Back/Return cierra gate.
- Persistencia:
  - Reiniciar app mantiene canales bloqueados y enabled.

