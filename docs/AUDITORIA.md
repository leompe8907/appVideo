# Reporte de Auditoría Técnica y Plan de Acción
## Proyecto: appVideo (Smart TV & Web OTT)

Este reporte detalla los hallazgos débiles, críticos y preocupantes encontrados durante la auditoría de código del proyecto **appVideo**. Las observaciones están enfocadas en asegurar la compatibilidad y el rendimiento óptimo en Smart TVs de 2019 en adelante (Samsung/Tizen y LG/webOS) y en la versión compartida para navegadores Web.

---

## 📋 Resumen Ejecutivo
El proyecto está construido sobre React 18 y Vite, utilizando Zustand para el manejo de estados globales y Video.js para el motor web. Cuenta con una separación conceptual de adaptadores nativos para TV (`SamsungEngine` y `LgEngine`), lo cual es una arquitectura correcta. Sin embargo, existen fallas críticas de configuración en la transpilación que impedirán el arranque de la app en televisores LG de 2019, configuraciones incorrectas que deshabilitan por completo la aceleración de hardware en la reproducción, e ineficiencias graves en el procesamiento de datos (EPG y Catchup) que congelarán el hilo principal en dispositivos TV de gama baja.

---

## 🔍 Detalle de Hallazgos por Grupo

### Grupo 1: Compatibilidad de Compilación y Configuración (Vite & Entorno)

#### 1.1 Configuración de Target de Chromium Errónea para webOS 2019
* **Ubicación:** [vite.config.js](file:///C:/Users/veyqp/Desktop/appVideo/vite.config.js#L54-L59)
* **Descripción:** El plugin legacy está configurado con `targets: ['chrome 61']` (con el comentario de que webOS 4 usa Chrome 61).
* **Problema Real:** Las Smart TVs LG de 2019 que corren **webOS 4.5 utilizan la versión Chromium 53**. Las Samsung TVs de 2019 con **Tizen 5.0 utilizan Chromium 63**.
* **Impacto Crítico:** Chromium 53 **no soporta sintaxis nativa de ES6+** como `async/await` (introducida en Chrome 55). Dado que Vite asume que Chrome 61 es el target más bajo, generará chunks modernos usando `async/await` nativos. Al cargar en webOS 4.5/2019, el motor del televisor arrojará un `SyntaxError` inmediato y la aplicación se quedará en **pantalla negra permanente**.
* **Acción:** Modificar el target en el plugin `@vitejs/plugin-legacy` a `chrome 53` y el target moderno a `chrome 63`.

#### 1.2 Ausencia de Scripts de Integración de Fabricantes
* **Ubicación:** [index.html](file:///C:/Users/veyqp/Desktop/appVideo/index.html)
* **Descripción:** El punto de entrada HTML no incluye las librerías nativas necesarias para que los sistemas operativos de TV expongan sus APIs globales de hardware.
* **Problema:** En Samsung Tizen, la inicialización segura de APIs como `webapis.avplay` requiere cargar `<script src="$WEBAPIS/webapis/webapis.js"></script>`. En LG webOS es estándar incluir `webOSTV.js` para comunicarse de manera segura con los servicios Luna (DRM, información del sistema).
* **Acción:** Incorporar la inyección condicional de scripts de integración TV según el agente de usuario o configuración de compilación.

---

### Grupo 2: Reproductores Multimedia y Aceleración por Hardware (DRM & Player)

#### 2.1 Adaptadores Nativos Desactivados por Defecto (Simulación Permanente)
* **Ubicación:** [brands.js](file:///C:/Users/veyqp/Desktop/appVideo/src/config/brands.js)
* **Descripción:** En la configuración de todas las marcas, la propiedad `player.nativeAdaptersEnabled` está establecida como `false`.
* **Problema:** Esto provoca que `resolveEnginePlatform` devuelva siempre `ENGINE_PLATFORM.WEB`, ejecutando Video.js + HLS.js (reproductor web) incluso en TVs.
* **Impacto Crítico:**
  1. **Rendimiento:** HLS.js realiza la demultiplexación de video en JS. Las TVs de 2019 saturarán sus procesadores con streams Full HD, resultando en caídas masivas de frames (stuttering).
  2. **Falla de DRM (Widevine / PlayReady):** El reproductor Web en Video.js no está acoplado con los CDMs nativos de los fabricantes en TV. Las transmisiones protegidas con DRM de Panaccess fallarán por completo.
* **Acción:** Cambiar `nativeAdaptersEnabled` a `true` en las marcas destinadas a despliegues en televisores.

#### 2.2 Falta de Control de Errores síncronos en AVPlay (Samsung)
* **Ubicación:** [SamsungEngine.js](file:///C:/Users/veyqp/Desktop/appVideo/src/player/engines/samsung/SamsungEngine.js#L156-L179)
* **Descripción:** Los métodos `nativePlay()`, `nativePause()` y `nativeSeek()` llaman directamente al objeto nativo `avplay` sin control de excepciones.
* **Problema:** AVPlay posee una estricta máquina de estados. Si se intenta realizar un `seek` o llamar a `play` antes de que la TV complete el estado `READY` (o tras un error intermedio de red), el sistema arrojará una excepción síncrona.
* **Impacto:** Al no haber un bloque `try-catch`, el hilo de ejecución de JS se interrumpe, provocando que la interfaz de React deje de responder.
* **Acción:** Envolver el control de reproducción en bloques `try-catch` y mapear los fallos al método `emitNativeError`.

#### 2.3 Fuga de Memoria y Eventos Huérfanos en AVPlay
* **Ubicación:** [SamsungEngine.js](file:///C:/Users/veyqp/Desktop/appVideo/src/player/engines/samsung/SamsungEngine.js#L210-L229)
* **Descripción:** Durante la llamada a `nativeDestroy()`, se limpian variables pero no se remueve el listener en la API nativa de Tizen.
* **Impacto:** Si el usuario realiza un zapping rápido, el listener viejo de la instancia destruida seguirá asociado en la capa nativa y disparará callbacks en variables que ya son nulas, causando inestabilidad en el runtime de la aplicación.
* **Acción:** Asegurar la llamada a `api.setListener(null)` o `api.setListener({})` al destruir el motor.

#### 2.4 Retención de Decodificador de Hardware en LG webOS
* **Ubicación:** [LgEngine.js](file:///C:/Users/veyqp/Desktop/appVideo/src/player/engines/lg/LgEngine.js#L194-L217)
* **Descripción:** El método `nativeDestroy()` del motor de LG desvincula variables pero no limpia el atributo `src` del elemento `<video>` nativo.
* **Problema:** Los televisores de 2019 disponen de un único pipeline de decodificación por hardware de video.
* **Impacto:** Si la fuente no es liberada de forma explícita mediante `video.src = ""` seguido de `video.load()`, el decodificador nativo quedará bloqueado y los siguientes intentos de reproducir otros canales o contenidos VOD fallarán (pantalla negra o error de reproducción).
* **Acción:** Añadir la limpieza explícita del pipeline de video nativo durante la destrucción.

#### 2.5 Condiciones de Carrera en Luna Service DRM (webOS)
* **Ubicación:** [LgEngine.js](file:///C:/Users/veyqp/Desktop/appVideo/src/player/engines/lg/LgEngine.js#L212)
* **Descripción:** La llamada `this._webosUnloadDrmClient()` en la fase de destrucción no es bloqueante (se dispara en segundo plano con un `.catch(() => {})`).
* **Problema:** Durante un cambio de canal rápido, la app llamará a `load` para el cliente de DRM del nuevo canal antes de que finalice la petición `unload` del canal anterior.
* **Impacto:** El servicio Luna de LG arrojará un error de inicialización, interrumpiendo el flujo de obtención de licencias para el nuevo stream.
* **Acción:** Sincronizar el ciclo de carga/descarga DRM utilizando promesas encadenadas o estados de transición.

---

### Grupo 3: Algoritmos y Flujos de Datos Ineficientes (Rendimiento)

#### 3.1 Algoritmo de Catchup con Complejidad O(T * G * E)
* **Ubicación:** [preloadStore.js](file:///C:/Users/veyqp/Desktop/appVideo/src/store/preloadStore.js#L515-L563)
* **Descripción:** Para estructurar las grabaciones activas (`prepareRecorded`), la app itera sobre las tareas ($T$), buscando secuencialmente dentro de cada grupo ($G$) y comparando cada uno de sus eventos ($E$).
* **Problema:** Con 100 tareas, 40 grupos y 50 eventos, la aplicación realiza hasta **200,000 iteraciones** en el hilo principal de renderizado.
* **Impacto:** En procesadores de TV de 2019 (usualmente de doble núcleo a 1.2 GHz), esta operación tardará segundos, congelando la UI y provocando un retraso inaceptable en el control remoto.
* **Acción:** Crear previamente un mapa indexado de `eventId -> { group, event }` en complejidad lineal $O(G \times E)$ para realizar búsquedas instantáneas $O(1)$ por tarea.

#### 3.2 O(C * V) y Duplicidad en Procesamiento de VOD
* **Ubicación:** [vodService.js](file:///C:/Users/veyqp/Desktop/appVideo/src/services/vodService.js#L73-L120)
* **Descripción:** La función `prepareDataForVOD` realiza un filtrado completo del array de VODs por cada categoría ($O(C \times V)$). Además, realiza el cómputo de `buildVodImageUrls` múltiples veces sobre el mismo VOD si este pertenece a varias categorías.
* **Impacto:** Creación masiva de objetos redundantes en memoria y alto costo de Garbage Collection, resultando en saltos o lag en la navegación de VOD.
* **Acción:** Realizar un único mapeo lineal de los VODs, construir sus URLs una sola vez y distribuirlos en listas indexadas por categoría ID.

#### 3.3 Petición Secuencial e Individual de EPG por Canal
* **Ubicación:** [epgService.js](file:///C:/Users/veyqp/Desktop/appVideo/src/services/epgService.js#L203-L228)
* **Descripción:** Para cargar la guía de programación, la aplicación itera sobre los canales de forma síncrona esperando que cada descarga finalice (`for (...) { await fetchEPG(...) }`).
* **Impacto:** Si la guía de inicio despliega 10 canales, se realizan 10 conexiones HTTP secuenciales. Esto introduce un retraso acumulado inaceptable (3 a 5 segundos de espera).
* **Acción:** Implementar una descarga asíncrona concurrente mediante un pool de peticiones simultáneas (ej. lotes de 3 a 5 canales concurrentes con `Promise.all`).

#### 3.4 Inconsistencia de Tipos en EPG y Falla de Envío en Web Worker
* **Ubicación:** [epgService.js](file:///C:/Users/veyqp/Desktop/appVideo/src/services/epgService.js#L225-L226) y [epgNormalize.worker.js](file:///C:/Users/veyqp/Desktop/appVideo/src/workers/epgNormalize.worker.js#L44-L45)
* **Problemas:**
  1. Si los datos se procesan en el hilo principal (fallback), `startDate` y `endDate` se convierten en objetos (`{ valueOf: () => ms }`). Si se procesan en el Web Worker, se retornan como `number` (timestamps). Esto produce fallas de tipado en los componentes de UI.
  2. En `epgNormalize.worker.js`, el worker intenta retornar objetos que contienen funciones (`valueOf`). En JS, `postMessage` utiliza el algoritmo de clonación estructurada que **prohíbe el envío de funciones**. Esto genera un error `DataCloneError`, provocando que el Web Worker siempre falle en producción y obligue a la app a usar el hilo de render.
* **Acción:** Corregir el Web Worker para procesar y devolver timestamps planos (`number`). Adaptar la UI para trabajar con este tipo estandarizado de datos.

---

### Grupo 4: Arquitectura de Navegación Espacial (Teclado & TV)

#### 4.1 Navegación Espacial Fragmentada e Imperativa
* **Ubicación:** Carpeta [hooks/](file:///C:/Users/veyqp/Desktop/appVideo/src/hooks) (múltiples archivos `use*TvNav.js`) y componentes como [Sidebar.jsx](file:///C:/Users/veyqp/Desktop/appVideo/src/components/Sidebar.jsx).
* **Descripción:** Cada página y componente gestiona de manera independiente sus eventos de teclado (`keydown`), calculando imperativamente las relaciones de proximidad física del foco basándose en clases CSS duras (`.vod-card`, `.channel-card`).
* **Problema:** No hay un motor centralizado de navegación espacial. Cualquier cambio en la estructura HTML o nombres de clases rompe la navegación. Si el foco se pierde (situación común al cerrar modales), el usuario queda atrapado en un estado donde el mando remoto deja de responder.

---

## 🛠️ Plan de Acción Recomendado

### Fase 1: Correcciones de Compilación y Configuración
* **Paso 1:** Modificar [vite.config.js](file:///C:/Users/veyqp/Desktop/appVideo/vite.config.js#L54-L59) para ajustar los targets Chromium a `chrome 53` (LG 2019) y `chrome 63` (Samsung 2019).
* **Paso 2:** Inyectar los scripts de inicialización nativos en `index.html`.

### Fase 2: Corrección y Activación del Reproductor Nativo
* **Paso 3:** Habilitar `nativeAdaptersEnabled` en [brands.js](file:///C:/Users/veyqp/Desktop/appVideo/src/config/brands.js) para los entornos TV reales.
* **Paso 4:** Añadir envoltorios `try-catch` en `SamsungEngine.js` y asociar `api.setListener(null)` en la destrucción.
* **Paso 5:** Asegurar la liberación del pipeline del decodificador de video en `LgEngine.js` (`video.src = ""`).

### Fase 3: Optimización de Rendimiento de Datos
* **Paso 6:** Optimizar la función `prepareRecorded` de `preloadStore.js` reduciendo su complejidad de $O(T \times G \times E)$ a $O(G \times E + T)$.
* **Paso 7:** Reestructurar `prepareDataForVOD` en `vodService.js` para reducirlo a un mapeo lineal y evitar múltiples llamadas a `buildVodImageUrls`.
* **Paso 8:** Reemplazar el bucle secuencial en `loadEPGForChannels` por llamadas concurrentes limitadas.
* **Paso 9:** Estandarizar las fechas de la EPG a timestamps numéricos planos y remover las funciones del Web Worker para solventar el `DataCloneError`.

---

## 📺 Análisis y Recomendación sobre la Navegación TV

Al evaluar si es preferible mantener la lógica de navegación actual basada en hooks específicos o realizar una migración hacia una librería de navegación espacial, se concluye lo siguiente:

### Comparativa Técnica

| Característica | Lógica Actual (Hooks Ad-hoc) | Librería de Navegación Espacial |
|---|---|---|
| **Estructura** | Fragmentada en múltiples hooks (`useVodPageTvNav`, `useLoginTvNavigation`, etc.) y componentes. | Centralizada. Los elementos se registran declarativamente en un motor espacial. |
| **Cálculo de Foco** | Manual. Basado en índices fijos y selectores DOM duros (`querySelector`). | Automático. La librería calcula las distancias físicas entre elementos usando sus coordenadas 2D. |
| **Resiliencia** | Muy frágil. Si cambia el layout HTML o las clases CSS, la navegación se rompe. | Alta. Los cambios en el diseño no rompen el flujo porque se recalculan las posiciones reales. |
| **Mantenimiento** | Alto. Requiere escribir decenas de líneas de código manual por cada página nueva. | Bajo. Integración declarativa directa en JSX (ej: `<Focusable>`). |
| **Rendimiento** | Regular/Malo. Múltiples lecturas síncronas al DOM durante cada pulsación de tecla. | Óptimo. La librería minimiza reflows y gestiona eficientemente el estado en React. |

### Recomendación del Experto:
**Se recomienda migrar a una librería de navegación espacial** (como `@noriginmedia/react-spatial-navigation` o `@react-spatial-navigation`).

Para evitar riesgos de regresión y asegurar entregas estables, la migración debe realizarse bajo un **enfoque incremental**:
1. **Centralización Base:** Integrar el motor de navegación espacial en el punto de entrada de la app y definir el contenedor de foco principal.
2. **Reemplazo en Pantallas Complejas:** Migrar primero las páginas que sufren mayor dinamismo (como `VodPage` y `EpgCardsPage`) donde el cálculo de filas, columnas y zonas de publicidad secundarias genera alta complejidad.
3. **Migración de Menú Lateral:** Adaptar la [Sidebar](file:///C:/Users/veyqp/Desktop/appVideo/src/components/Sidebar.jsx) para interactuar declarativamente con las zonas de contenido principal.
4. **Fase Final (Estática):** Migrar vistas estáticas y sencillas (`LoginPage`, `SmartCardPage`) una vez estabilizada la infraestructura.
