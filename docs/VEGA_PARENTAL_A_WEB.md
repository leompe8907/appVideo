# Control parental: ajustes de diseño de Vega para replicar en la web

La pantalla de Control parental del Fire TV (`apps/vega/src/parental/ParentalSettings.jsx`)
tiene la misma estructura y lógica que la web (`src/pages/ParentalSettingsPage.jsx`), pero
el diseño se ajustó para TV. Esta es la lista de diferencias para llevarlas a la web
(`src/styles/pages/_parental.scss` y `src/components/parental/ParentalChannelCard.jsx`).

Medidas a 1920×1080.

## 1. Tarjeta de canal (el cambio más visible)

| | Web actual | Vega |
|---|---|---|
| Logo | Caja 16:9 a todo el ancho de la tarjeta | Logo centrado de 150×70, `contain` |
| Texto | Grilla de 2 columnas: LCN · nombre | Una línea centrada: `"2 TV Jornal"` (18px, 600) |
| Estado | Sólo el candado encima del logo | Línea extra debajo: «Bloquear canal» (blanco 60%) o «🔒 Bloqueado» (`#ff8080`), 16px |
| Bloqueado | Tarjeta apagada (`opacity: .55`, `saturate(.75)`) | Fondo rojizo `rgba(255,80,80,0.12)`, sin apagar |
| Tamaño | Grilla de 6 columnas | Ancho fijo de 200px, padding 12, radio 12; caben 5 por fila |
| Foco | Anillo de foco general | Borde de 3px con el color de foco de la marca (sin foco: `rgba(255,255,255,0.12)`) |

Motivo: a distancia de TV, una tarjeta apagada puede leerse como deshabilitada; con el
texto «Bloquear canal / Bloqueado» queda claro el estado y qué hace OK.

## 2. Botones (toggle, PIN, clasificación)

- **Activo** («Activado», la clasificación elegida): fondo sólido `account.theme.activeItemBg`
  (`#5c8fc4` por defecto) con texto `activeItemText`, en lugar del violeta translúcido
  `rgba(102,126,234,0.25)`. Así coinciden con el ítem activo del menú de Mi Cuenta.
- **Inactivo**: `rgba(255,255,255,0.1)`, sin borde visible.
- **Foco**: borde de 3px con el color de foco de la marca.
- **Forma**: padding 10×22, radio 10. Los botones de clasificación son rectángulos
  (padding 18 a los lados), no pastillas de radio 999.
- **Texto**: 20px, 600.

## 3. Disposición

- **Ayuda de «Clasificación (BR)»**: va debajo del título, alineada a la izquierda; en la web va a la derecha en la misma fila.
- **Fondo de las tarjetas**: `rgba(255,255,255,0.05)`, radio 14, padding 24, separación 20,
  en lugar de `rgba(0,0,0,0.35)` con `blur`. El fondo de Mi Cuenta ya es oscuro.
- **Separador**: margen vertical de 18.
- **Grilla de canales**: sin scroll propio; hace scroll toda la página. Con D-pad, un scroll
  dentro de otro complica llevar a la vista el canal enfocado.

## 4. Tipografía (más grande para TV)

- Título 34 (700), subtítulo 22 (80%).
- Etiquetas de fila 24 (600), ayudas 20 (75%), mensajes («PIN guardado.», «Desbloqueo temporal activo…») 20.

## 5. Pedido de PIN

En Vega se escribe con el teclado numérico del sistema de Fire TV, no con el teclado en
pantalla de la web. El modal está escalado ×1.35 (igual que login y smartcard), con
caja de 440, radio 12, botón Confirmar con el color primario de la marca, y el campo se
limpia después de un PIN incorrecto. **No hace falta replicarlo en la web**; se anota sólo
como referencia.

## Lo que no cambió

Textos, flujo y reglas iguales a la web:
- El control se activa sin pedir PIN.
- Para desbloquear un canal se pide PIN; para bloquearlo, no.
- «Bloquear ahora» cierra el desbloqueo temporal.
- Las opciones de clasificación son L…18 y «Aplicar a TV en vivo».
