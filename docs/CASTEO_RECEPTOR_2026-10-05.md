# Casteo entre dispositivos — receptor en appVideo (Fase 2)

Rama: `feature/cast-multidispositivo`. Contrato del protocolo y decisiones:
`D:\Back-Wind-V2\docs\DISENO_TECNICO_CASTEO_2026-10-05.md` (backend, Fase 1 ya implementada).

## Qué hace

Este dispositivo (web / LG / Samsung) puede **recibir** un contenido enviado
desde otro dispositivo de la misma cuenta, reproducirlo, aceptar comandos
remotos (play, pause, stop, seek, volumen, audio, subtítulos) y reportar su
estado. **Apagado por defecto**: solo actúa si la marca tiene
`features.castEnabled: true` (`config/brands/defaults.js`, hoy `false`).

No incluye todavía la UI de controlador (selector de dispositivos para enviar).

## Por qué así

- El mensaje trae solo `{kind, id}`, nunca URL ni sesión: la sesión de
  PanAccess es distinta del JWT de Wind y es propia de cada dispositivo. El
  receptor arma su URL con su propia sesión (`getStreamM3u8Url`,
  `getVodM3u8Url`, `getCatchupM3u8Url` + `normalizePlaybackUrl`).
- Control parental: pasa por `requestPlayChannel` / `requestPlayMedia`, el mismo
  gate que cualquier reproducción; transmitir no evita el PIN.
- Posiciones en ms enteros en el protocolo; el reproductor usa segundos.

## Cómo (archivos)

| Archivo | Rol |
|---|---|
| `services/deviceSessionService.js` | Registro con `device_name`, `can_receive`, `capabilities`; `sendDeviceMessage`; reenvío de `cast.*` |
| `services/castService.js` | Cliente del protocolo: pedido/respuesta por `request_id` (timeout 8 s), eventos, `listDevices`, `sendContent`, `sendCommand`, `reportState` |
| `services/castReceiver.js` | Lógica pura: `resolvePlayRequest`, `buildCastState`, `applyCastCommand` |
| `hooks/useCastReceiver.js` | Integra con el player: reproduce, aplica comandos, `cast.displaced` detiene, estado ante cambios y cada 5 s, seek inicial en VOD/catchup |
| `App.jsx` | Monta `CastReceiverHost` |

## Verificación

- 36 tests nuevos (`services/__tests__/castService.test.js`, `castReceiver.test.js`): pasan.
  Se corrieron en una copia temporal con Linux (el `node_modules` del proyecto
  trae binarios solo de Windows). Para correrlos en tu equipo: `npx vitest run src/services/__tests__/cast`.
- Sintaxis de `useCastReceiver.js`, `App.jsx` y `deviceSessionService.js` validada.
- **No verificado**: ESLint, el hook dentro de la app real, ni prueba contra el backend
  en una TV. El hook no tiene test automático.

## Limitaciones conocidas

- VOD: no se evalúa clasificación por edad (solo hay `id`; no hay catálogo VOD
  precargado). Aplican los bloqueos por PIN generales.
- Si el canal no está en el catálogo de este dispositivo → `unsupported_content`.
- Sin confirmación en TV para cuentas distintas (`cast.accept`) ni arranque en frío
  (`/wind/cast/claim/`): fases siguientes.

## Prueba manual (cuando se active)

1. Backend: `python manage.py migrate wind`.
2. Poner `castEnabled: true` en la marca de prueba y abrir la app en dos dispositivos con la misma cuenta.
3. Desde una consola WS del segundo dispositivo, enviar `cast.list_devices` y luego `cast.send`
   con `{kind:'service', id:<id de canal>}` al receptor; verificar reproducción, `cast.command` y `cast.state`.
