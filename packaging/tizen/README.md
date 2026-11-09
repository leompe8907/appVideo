# Empaquetado Samsung Tizen

## Pasos

1. Build de marca: `pnpm run build:wind` (o la marca correspondiente).
2. Copiar `dist/{marca}/` al proyecto Tizen Studio.
3. Usar `config.xml` de esta carpeta como base (ajustar `id`, `tizen:application`, iconos).
4. En `index.html` del WGT, el bootstrap ya referencia `$WEBAPIS/webapis/webapis.js` en TV Tizen.

## Privilegios habituales

- `internet` — API backend
- `avplay` — reproducción nativa Samsung
- `drmplay` — DRM Widevine/PlayReady

## Variable de build opcional

```env
VITE_TV_PLATFORM=tizen
```

## Verificación en TV

- Consola: `typeof webapis !== 'undefined'`
- Log `[EnginePlatform]` con `source: 'api'` si las APIs nativas están disponibles.
