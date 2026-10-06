# Íconos

`react-native-svg` hace caer la app en el Fire TV Stick (SDK 0.24 / Vega OS 1.2),
así que los íconos van como PNG blancos con transparencia (96×96) y se tiñen con
`tintColor`. Las fuentes están en `src/`.

Para regenerar un PNG: dibujar el SVG en un `<canvas>` de 96×96 en cualquier
navegador y exportar con `canvas.toDataURL('image/png')` (`qlmanage` de macOS no
sirve: ignora el tamaño del SVG).
