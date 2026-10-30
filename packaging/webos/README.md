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
  "uiRevision": 2
}
```

## Variables de build opcionales

En `.env.local` o CI:

```env
VITE_TV_PLATFORM=webos
```

Fuerza la carga del SDK en el bootstrap aunque el User-Agent no sea concluyente.

## Verificación

- `window.webOS` debe existir antes de montar React (`__tvPlatformReady` en consola).
- Logs `[EnginePlatform]` al reproducir si `nativeAdaptersEnabled` está activo (Etapa 2).
