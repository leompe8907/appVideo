# Empaquetado LG webOS

## Contenido del IPK

1. Copiar el build de marca: `dist/{marca}/` → raíz del proyecto webOS.
2. Copiar **`webOSTV.js`** desde el SDK de LG webOS TV (`webOS_TV_SDK`) a la **misma carpeta que `index.html`**.

   El bootstrap (`public/tv-platform-bootstrap.js`) intenta cargar `webOSTV.js` automáticamente en dispositivos webOS.

3. No commitear `webOSTV.js` en este repositorio (licencia LG).

## appinfo.json (mínimo)

```json
{
  "id": "com.yourcompany.appvideo",
  "version": "1.0.0",
  "vendor": "Your Company",
  "type": "web",
  "main": "index.html",
  "title": "appVideo",
  "icon": "icon.png",
  "largeIcon": "icon.png",
  "uiRevision": 2,
  "disableBackHistoryAPI": true
}
```

### Botón Back (`disableBackHistoryAPI`)

Sin ese campo webOS maneja el Back con el historial del navegador y la app **nunca recibe la tecla**: desde la primera página lanza el Home del TV (la app queda suspendida y al volver sigue donde estaba, p. ej. en el player). Con `"disableBackHistoryAPI": true` la app recibe el keydown 461: cierra el player, vuelve por las secciones y, en Inicio, sale con `webOS.platformBack()` (popup de salida en webOS 6+, launcher en 5 o menos) o `window.close()` si no hay `webOSTV.js`.

Verificado en un LG 49UN7310PSC (webOS 5). Si usas un `appinfo.json` propio (p. ej. un IPK "envoltorio" que solo redirige a una URL) agrégalo ahí también.

## Variables de build opcionales

En `.env.local` o CI:

```env
VITE_TV_PLATFORM=webos
```

Fuerza la carga del SDK en el bootstrap aunque el User-Agent no sea concluyente.

## Verificación

- `window.webOS` debe existir antes de montar React (`__tvPlatformReady` en consola).
- Logs `[EnginePlatform]` al reproducir si `nativeAdaptersEnabled` está activo (Etapa 2).
