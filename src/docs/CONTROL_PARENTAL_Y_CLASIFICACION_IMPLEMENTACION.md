# Control Parental — Implementación actual + Bloqueo por Clasificación (BR)

Este documento describe **lo que hoy hace el módulo de Control Parental** en la app (bloqueo por canal + PIN + gate + UX TV) y especifica la **nueva implementación** propuesta para **bloqueo por clasificación indicativa** (Brasil) usando `parentalRating`.

---

## 1) Objetivos

### 1.1 Bloqueo por canal (Opción A)
- El canal **permanece visible** en Inicio / EPG / Buscador / Player.
- Si el canal está **bloqueado**, al intentar reproducir se solicita **PIN**.

### 1.2 Bloqueo por clasificación (BR)
- Bloquear reproducción de contenido (VOD / Catchup / Live-EPG) según **edad mínima**.
- Basado en `parentalRating` provisto por backend (string o number).

---

## 2) Estado actual (lo ya implementado)

### 2.1 Persistencia y store
- Se usa Zustand para mantener:
  - `enabled`: ON/OFF del control parental (aplica enforcement o no).
  - `blockedChannelIds`: lista de ids de canales bloqueados.
  - `pinHash` + `pinSalt` + metadata: PIN persistido sin guardar texto plano.
  - `unlockUntilMs` + `lastUnlockScope` + `lastUnlockedChannelId`: desbloqueo temporal.

Persistencia:
- En `localStorage` con **namespace por marca**:
  - `parental.v1.<brand>`

Notas:
- El PIN se deriva por **PBKDF2** (WebCrypto) con fallback SHA256 si WebCrypto no está disponible.

### 2.2 Qué significa “ON/OFF”
- **OFF**: no se aplica bloqueo (aunque existan canales marcados como bloqueados).
- **ON**: aplica bloqueo por canal (y en el futuro por rating) en los puntos de reproducción.

### 2.3 “Bloquear ahora”
- Función de seguridad/UX:
  - Invalida el **desbloqueo temporal vigente** (`unlockUntilMs`) para volver a exigir PIN.

### 2.4 Gate único (PIN modal)
Problema resuelto:
- Se centralizó el estado del gate en un **store global** para que cualquier parte de la UI pueda abrir el gate
  y el modal se renderice una sola vez.

El gate soporta:
- **Playback**: al reproducir un canal bloqueado (o en el futuro un contenido por rating).
- **Action** (administrativo): para cambiar bloqueos desde el panel (desbloquear) siempre exige PIN aunque exista unlock temporal.

### 2.5 Scope actual del desbloqueo
Para bloqueo por canal:
- Desbloqueo **temporal por canal** (no libera todos los canales bloqueados).

Para acciones administrativas:
- Validación de PIN sin abrir unlock temporal.

### 2.6 Panel “Control parental”

#### PIN
- Si **no existe PIN**: se permite “Configurar PIN”.
- Si **existe PIN**: “Cambiar PIN” solicita PIN actual y luego el nuevo.
- “Olvidé mi PIN”: no resetea localmente; muestra aviso (requiere política de recovery: re-login/soporte).

#### Canales (UI en cartas)
- Se renderiza un grid de cards con:
  - logo
  - LCN
  - nombre
- Canales bloqueados se ven:
  - **opacados**
  - con **candado centrado**

Reglas al tocar una card:
- Si está **Permitido** → se bloquea (sin PIN).
- Si está **Bloqueado** → se solicita PIN y si es correcto se desbloquea (pasa a Permitido).

### 2.7 Indicadores visuales en Inicio (Bouquets)
- Las tarjetas del muro de bouquets se opacan si el canal está bloqueado.
- Mantienen enfoque/selección (no se ocultan).

### 2.8 Player: botón en header para bloquear/desbloquear canal
- En `PlayerHud` (cuando `type === 'service'`):
  - aparece un botón 🔒/🔓 para bloquear/desbloquear el canal actual
  - desbloquear solicita PIN (acción administrativa)

---

## 3) Puntos de enforcement (bloqueo por canal)

Se centraliza el control antes de llamar a `player.play(...)`.
Entrada típica: `requestPlayChannel({ channel, playFn, ... })`.

Se cubren los principales entrypoints:
- Inicio (Bouquets)
- Servicios TV/Radio (Bouquets no-main)
- EPG (Play live desde modal)
- Buscador (resultados service/epg)
- Player overlay (zapping/listado)
- Home ads (`stream_id=...`)

---

## 3.1 Nueva regla — `parentalControl` (flag del backend)

Algunos servicios/canales pueden venir desde backend con:
- `parentalControl: true` (o variantes `parental_control`)

Regla requerida:
- Si `parentalControl === false` ⇒ **no se pide PIN** por este motivo.
- Si `parentalControl === true` ⇒ **se pide PIN** antes de reproducir, incluso si el canal no está bloqueado manualmente.

### 3.1.1 Caso especial: bouquets con varios canales “adultos”

Necesidad UX:
- En bouquets “adultos”, es común que **varios canales seguidos** tengan `parentalControl:true`.
- Pedir PIN en cada zapping es demasiado invasivo en TV.

Solución implementada:
- Se calcula cuántos canales del **bouquet actual** tienen `parentalControl:true`.
  - Si el bouquet tiene **1 solo canal adulto**:
    - Al ingresar PIN se habilita un **unlock de sesión** (sin TTL).
    - Este unlock se **invalida automáticamente** al reproducir un canal con `parentalControl:false` o al usar “Bloquear ahora”.
  - Si el bouquet tiene **2 o más canales adultos**:
    - Al ingresar PIN se habilita un **unlock global con TTL**.
    - Este unlock se **invalida automáticamente** al reproducir un canal con `parentalControl:false` o al usar “Bloquear ahora”.

Notas:
- El unlock por `parentalControl` es **independiente** del unlock por canales bloqueados manualmente y del unlock por rating.
- Por seguridad, el unlock por `parentalControl` es **solo de sesión** (no se persiste).

### 3.1.2 Configuración por marca (TTL)

El TTL (cuando aplica) es configurable por marca en `brands.js`:
- `parental.parentalControlMultiTtlMs` (ms)

Default:
- 40 minutos (\(40 \times 60 \times 1000\))

## 4) Nueva implementación — Bloqueo por Clasificación (Brasil)

### 4.1 Valores esperados (BR)
Clasificación indicativa:
- Livre: `L` o `AL` ⇒ 0
- `A10` / `10` ⇒ 10
- `A12` / `12` ⇒ 12
- `A14` / `14` ⇒ 14
- `A16` / `16` ⇒ 16
- `A18` / `18` ⇒ 18

Confirmado:
- `0` significa **Libre**.

### 4.2 Normalización (string | number)
Backend puede enviar:
- VOD: `parentalRating: "14"` (string numérico)
- EPG: `parentalRating: 10` (number) o `0`

Se recomienda normalizar a:
- `0 | 10 | 12 | 14 | 16 | 18 | null`

Reglas:
- number:
  - `0` ⇒ 0 (Livre)
  - `10/12/14/16/18` ⇒ ese valor
  - otro ⇒ `null`
- string:
  - trim + uppercase
  - `L`/`AL` ⇒ 0
  - `A10..A18` ⇒ map
  - si contiene dígitos (ej `14`, `14+`, `+14`) ⇒ parse a 10/12/14/16/18 si coincide
  - si no ⇒ `null`

### 4.3 Configuración UI (Tab “Clasificación”)
Propuesta de configuración dentro de Control Parental:
- Toggle: **Bloquear por clasificación**
- Selector: **Permitir hasta**
  - `Livre`, `10`, `12`, `14`, `16`, `18`
- (Opcional para rollout) Checkbox:
  - “Aplicar también a TV en vivo (EPG)”

### 4.4 Regla de gate por rating
Sea:
- `allowedMax` = umbral configurado (“permitir hasta”)
- `rating` = valor normalizado del contenido

Bloquear si:
- `ratingEnabled === true`
- `rating != null`
- `rating > allowedMax`

Si `rating == null`:
- Recomendado: **no bloquear por rating** (evitar falsos positivos por metadata incompleta).

### 4.5 Prioridad con bloqueo por canal
Prioridad recomendada:
1. Canal bloqueado (si aplica) ⇒ pedir PIN
2. Si canal permitido ⇒ evaluar rating ⇒ pedir PIN si excede umbral

### 4.6 Dónde aplicar rating gate (enforcement)
Recomendación inicial (MVP):
- Gate **en el momento de reproducir**:
  - VOD: antes de `player.play({ type: 'vod' ... })`
  - Catchup: antes de `player.play({ type: 'catchup' ... })`
  - Live/EPG: en el botón “Reproducir en vivo” o acción de play

Fase posterior (más restrictiva):
- Gate al abrir detalle (no recomendado para MVP por fricción).

### 4.7 Unlock temporal para rating
Recomendación UX:
- Para rating, conviene un unlock temporal “global por TTL” (ej. 15 min),
  porque el usuario puede navegar varios contenidos 14+/16+ y sería muy invasivo pedir PIN cada vez.

Este unlock debe ser **independiente** del unlock por canal (opcionalmente: estados separados).

---

## 5) Guardrails UI/UX (TV)
- **Nunca scroll horizontal** en el panel:
  - forzar `overflow-x: hidden` en contenedores
  - usar `grid-template-columns: repeat(N, minmax(0, 1fr))`
  - ellipsis para nombres largos
- Scroll vertical:
  - permitido, pero se puede **ocultar el scrollbar** manteniendo scroll funcional.
- Acciones administrativas:
  - desbloquear en settings siempre pide PIN
  - bloquear no pide PIN

---

## 6) Checklist de QA (mínimo)

### Canales
- [ ] Canal bloqueado en Inicio: se ve opacado + candado, al Enter pide PIN.
- [ ] Desbloqueo temporal por playback: solo aplica al canal desbloqueado.
- [ ] “Bloquear ahora”: vuelve a pedir PIN inmediatamente.
- [ ] Desbloquear desde settings: pide PIN y queda Permitido.
- [ ] PlayerHud: botón 🔒/🔓 funciona y respeta PIN.

### Rating (cuando se implemente)
- [ ] VOD con rating 14, allowedMax=12 ⇒ pide PIN.
- [ ] VOD rating 10, allowedMax=12 ⇒ permite play sin PIN.
- [ ] EPG rating 0 (Livre) ⇒ permite play.
- [ ] EPG rating 16, allowedMax=14 ⇒ pide PIN.
- [ ] Rating faltante/invalid ⇒ no bloquea por rating.

