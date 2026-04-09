## Control parental — lógica `parentalControl` (flag backend)

Este documento describe la lógica implementada para el flag de backend `parentalControl` en canales/servicios y cómo se combina con:
- bloqueo manual por canal (lista `blockedChannelIds`)
- bloqueo por clasificación (rating BR)

---

## Reglas

### 1) Cuando `parentalControl` es `false`
- **No** se pide PIN por este motivo.
- El canal puede reproducirse normalmente (salvo que esté bloqueado manualmente o por rating).

### 2) Cuando `parentalControl` es `true`
- Se pide **PIN** antes de reproducir.
- Para evitar pedir PIN “en cada zapping” en bouquets adultos, se aplica una excepción basada en el **conteo de canales adultos dentro del mismo bouquet**:

#### 2.1 Bouquet con 1 solo canal adulto
- Al ingresar PIN se habilita un **unlock de sesión** (sin TTL).
- Este unlock se invalida automáticamente al:
  - reproducir un canal con `parentalControl:false`
  - presionar “Bloquear ahora”
  - desactivar Control Parental

#### 2.2 Bouquet con 2 o más canales adultos
- Al ingresar PIN se habilita un **unlock global con TTL**.
- Este unlock se invalida automáticamente al:
  - reproducir un canal con `parentalControl:false`
  - presionar “Bloquear ahora”
  - desactivar Control Parental

Notas de seguridad:
- El unlock de `parentalControl` es **independiente** del unlock por rating y del unlock por bloqueo manual.
- Por diseño, el unlock de `parentalControl` es **solo de sesión** (no se persiste en `localStorage`).

---

## Configuración por marca

El TTL para el caso “2+ canales adultos” se configura por marca:
- **Clave**: `parental.parentalControlMultiTtlMs`
- **Default**: 40 minutos

Ejemplo (en `src/config/brands.js`):

```js
{
  brand: "bromteck",
  // ...
  parental: {
    parentalControlMultiTtlMs: 40 * 60 * 1000,
  },
}
```

---

## Orden de prioridades (playback)

Antes de reproducir un canal en vivo, el gate evalúa:
1. Bloqueo manual de canal (si aplica) → PIN (unlock por canal).
2. `parentalControl:true` (si aplica) → PIN (unlock sesión o TTL global según bouquet).
3. Rating (BR) para live si está habilitado y aplica a EPG → PIN (unlock global por TTL).

