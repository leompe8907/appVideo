# Íconos

`react-native-svg` hace caer la app en el Fire TV Stick (SDK 0.24 / Vega OS 1.2),
así que los íconos van como PNG blancos con transparencia (96×96) y se tiñen con
`tintColor`. Se generan con:

    node scripts/gen-icons.js

- `nav-*.png`: de `src/components/HomeNavIcon.jsx` de la web (misma fuente).
- El resto: de `src/*.svg` de esta carpeta.
