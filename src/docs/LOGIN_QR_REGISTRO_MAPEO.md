# Mapeo de Registro por QR (Legacy -> App React)

## Objetivo

Dejar trazabilidad del flujo de **registro por QR** que existe en el proyecto legacy (`EPG`) y definir su mapeo funcional para implementarlo en la app React (`app`).

---

## Alcance del mapeo

- Flujo de UI de registro QR en pantalla de login.
- Condiciones de visibilidad por marca.
- Generacion del QR y URL de destino.
- Navegacion/foco para TV.
- Dependencias tecnicas requeridas.

No cubre en este documento la implementacion de login por UDID ni login social.

---

## Fuente Legacy Analizada

- `EPG/public/js/scene/login.js`
- `EPG/public/index.html`

---

## Mapeo Funcional 1:1

| Comportamiento en legacy | Evidencia legacy | Equivalente/Propuesta en app React |
|---|---|---|
| Boton "Registro" en login | `#btnRegisterSubmit` en `index.html` + handler en `onEnter()` de `login.js` | Agregar boton secundario en `LoginPage.jsx` (`FocusableButton`) para abrir modal QR |
| Popup de registro con QR | `showRegisterPopup()` construye `.register-popup` y `#qrcode` | Modal React controlado por estado (`isQrModalOpen`) con contenedor QR |
| QR con URL fija de registro | `QRCode(... text: "https://shop.fotelka.tv/?c=customer&p=register")` | Mover URL a configuracion por marca (`brands.js`), con fallback seguro |
| Cierre de popup y retorno de foco | `closeRegisterPopup()` + `Focus.to($('#btnRegisterSubmit'))` | Cerrar modal y devolver foco al boton de registro usando focusKey de Spatial Navigation |
| Mostrar registro solo para marcas especificas | `clientelement()` habilita `.register` para `fotelka`, `lotos`, `bromteck` | Reemplazar hardcode por flag de marca (`features.qrRegister` o `login.qrRegister.enabled`) |
| Texto i18n del popup y boton | `updatePopupTexts()` con `__("TextRegister")`, `__("CloseButton")` | Agregar claves en `locales/*.json` (`login.register`, `login.registerHint`, `common.close`) |
| Dependencia de libreria QR por CDN | `index.html` carga `qrcodejs2` | En React usar libreria npm (ej. `qrcode`) o componente QR, evitando CDN global |

---

## Detalle de comportamiento observado (legacy)

1. La escena de login renderiza el boton de registro, pero inicialmente oculto.
2. `clientelement()` decide si se muestra el bloque `.register` segun `CONFIG.app.brand`.
3. Al presionar Enter/click sobre `btnRegisterSubmit`, llama `showRegisterPopup()`.
4. El popup inserta:
   - Texto explicativo (`.textRegister`)
   - Contenedor QR (`#qrcode`)
   - Boton cerrar (`#btnClosePopup`)
5. Genera el QR con `QRCode` y URL hardcodeada de registro.
6. Al cerrar popup, destruye el nodo y devuelve foco al boton de registro.

---

## Decisiones recomendadas para React

1. **Configurable por marca**
   - Agregar en `brands.js`:
     - `features.qrRegister: boolean`
     - `api.registerQrUrl: string` (o `login.registerQrUrl`)
2. **Sin URL hardcodeada**
   - La URL debe salir de configuracion de marca para evitar acoplamiento.
3. **Modal declarativo**
   - Render condicional en `LoginPage.jsx` (no construir HTML con strings).
4. **Accesible y TV-friendly**
   - Botones con `FocusableButton` y focusKey definido.
   - Cerrar con boton dedicado (y opcionalmente tecla Return/Escape).
5. **Dependencia QR mantenible**
   - Preferir paquete npm (`qrcode`) en lugar de script CDN global.

---

## Propuesta de estructura en `brands.js`

Ejemplo de estructura minima sugerida:

```js
features: {
  // ...
  qrRegister: true,
},
api: {
  // ...
  registerQrUrl: "https://shop.fotelka.tv/?c=customer&p=register",
}
```

---

## Checklist de implementacion (siguiente paso)

- [ ] Agregar flags/URL por marca en `src/config/brands.js`.
- [ ] Extender `src/pages/LoginPage.jsx` con boton "Registro".
- [ ] Crear modal QR en login (estado local + cierre + foco).
- [ ] Integrar generacion QR con libreria npm.
- [ ] Agregar traducciones en `src/locales/es.json`, `en.json`, `pt.json`.
- [ ] Ajustar estilos en `src/styles/components/_login.scss`.
- [ ] Validar navegacion con control remoto (up/down/enter/return).

---

## Riesgos y consideraciones

- Si no se define `registerQrUrl` para una marca, el boton debe ocultarse o deshabilitarse.
- Debe evitarse romper el flujo actual de login usuario/contrasena.
- En TV, el manejo de foco al abrir/cerrar modal es critico para usabilidad.

---

## Estado

Documento creado para registro de mapeo.
Implementacion pendiente.
