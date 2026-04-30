# Auditoría 360° y Plan de Acción Arquitectónico

**Fecha:** 30 de Abril de 2026  
**Objetivo:** Análisis de la arquitectura actual del proyecto `appVideo` (React + Vite) enfocado en la optimización y viabilidad para entornos Smart TV (LG webOS 4+ y Samsung Tizen 2019+), identificando fortalezas, deuda técnica, riesgos críticos y definiendo una ruta de acción.

---

## 📋 1. Reporte de Auditoría Arquitectónica

### 🟢 Puntos Fuertes (A Preservar)
1. **Stack Moderno y Tooling:** La adopción de **React 18 + Vite (SWC)** es un salto sustancial. La configuración del `vite.config.js` separa correctamente los *chunks* (ej: carga perezosa de páginas y separación del motor de video), garantizando un tiempo de inicio (boot time) optimizado.
2. **Device Detection Robusto:** El uso del hook `useDeviceDetection` aprovecha de manera inteligente una combinación de `User-Agent`, APIs nativas del sistema (ej. `window.tizen`, `window.webOS`) y Media Queries, logrando identificar el entorno sin falsos positivos.
3. **Estructura de Routing Eficiente:** El uso extendido de `Suspense` y `lazy loading` en el sistema de rutas (`App.jsx`) previene la sobrecarga de memoria durante la carga inicial de la aplicación.
4. **Tooling Listo para Escalar:** La base del proyecto cuenta con dependencias clave ya instaladas (`zustand` y `@tanstack/react-query`) que ofrecen el ecosistema ideal para modernizar el estado y el data-fetching.

### 🟡 Puntos Débiles (Deuda Técnica y Rendimiento)
1. **Manejo de Foco "Artesanal":** Tras el *rollback* de la librería de navegación espacial (debido a problemas en Tizen), el foco quedó gestionado mediante `tabIndex={0}` y eventos `onKeyDown` nativos (ej. `FocusableCard`). Confiar en el ruteo de foco nativo del navegador de la TV suele ser impredecible y propenso a errores al mutar el DOM.
2. **Context Hell (Cascada de Re-renders):** Componentes de alto nivel como `HomePage` dependen de contextos muy abarcativos (como `PlayerContext`). Si el player actualiza su estado (ej. progreso del tiempo), esto fuerza el re-render de toda la interfaz superior, lo que castiga severamente los FPS y calienta el SoC de TVs de gama media/baja.
3. **Falta de Virtualización en Grillas:** Las vistas pesadas como el EPG o las grillas de VOD no parecen virtualizar los nodos del DOM. Renderizar cientos de elementos ocultos en pantalla es una de las principales causas de *Out of Memory* en webOS y Tizen.

### 🔴 Puntos Críticos (Riesgo de Estabilidad)
1. **Memory Leaks en Eventos del Reproductor:** Motores como `WebEngine` acoplan *event listeners* al tag global `<video>`. Si estos listeners no se limpian de manera estricta (`removeEventListener`) durante el desmontaje (zapping o salida del player), la aplicación colapsará eventualmente por saturación de RAM.
2. **Preload Masivo de Datos (N+1):** Existen cuellos de botella en la fase de carga inicial (`PreloadDataPage`) donde la descarga secuencial del EPG/VOD puede agotar el *thread* de red, superando los tiempos de respuesta exigidos por las tiendas de LG y Samsung.
3. **Pérdidas Silenciosas de Foco:** Al re-renderizar componentes o recargar datos, el elemento enfocado puede ser destruido. En TVs, esto arroja el foco al `document.body`, dejando la app inoperable por control remoto hasta que se hace un foco manual o se presiona una tecla de sistema.

---

## 🛠️ 2. Decisiones Técnicas Acordadas

Tras debatir con el equipo, se han establecido los siguientes parámetros para el desarrollo inmediato:

* **Navegación Espacial (Foco):** Se descartan librerías de terceros basadas en geometría (Raycasting) que fallan en Tizen. Se implementará un **enfoque lógico basado en coordenadas (Grid 2D) / LRUD** más seguro y predecible.
* **Manejo de Datos (React Query):** Se utilizará `@tanstack/react-query` para todo el manejo pesado de datos (EPG, VOD) para aprovechar sus características de Caché, Stale-While-Revalidate y control de reintentos, resolviendo así el cuello de botella del *preload*.
* **Reproductor de Video:** Se mantiene la etiqueta global `<video>`. Actualmente **no se implementará encriptación ni DRM (PlayReady)**, simplificando drásticamente el flujo. El enfoque se pondrá 100% en el manejo de memoria y *cleanup* de eventos del motor.

---

## 🗺️ 3. Plan de Acción (Roadmap)

### Fase 1: Estabilización Crítica y Foco
**Objetivo:** Evitar *crashes* y devolver la operabilidad por control remoto a la aplicación.
1. **Auditoría de Leaks del Player:** Refactorizar `WebEngine` (y contextos asociados) asegurando que todo `addEventListener` tenga su contraparte de destrucción para evitar fugas de memoria.
2. **Nuevo Motor de Foco Logico:** Diseñar e implementar un sistema de foco propio (Grid 2D Logic / IDs explícitos) que no dependa de Tizen para calcular coordenadas.
3. **Focus Trap / Recovery:** Garantizar que si una tarjeta (VOD/EPG) se recarga o desmonta, el sistema redireccione el foco inmediatamente a un punto seguro (ej. menú lateral) para que el control remoto no quede inutilizado.

### Fase 2: Performance de Red y Reducción de Renders
**Objetivo:** Cargas instantáneas y navegación fluida a 60 FPS.
1. **Migración a React Query:** Reemplazar los *fetch* manuales en los catálogos y guía EPG por queries cacheadas. Implementar `AbortControllers` para cancelar peticiones de red si el usuario hace "zapping" rápido.
2. **Segmentación del Estado con Zustand:** Mover el estado volátil (ej. el reloj del player, el tick del EPG) fuera del `PlayerContext` hacia *stores* de Zustand. Esto prevendrá que el *Shell* de la app se vuelva a renderizar por completo cada segundo.

### Fase 3: Optimización del DOM y UX TV-First
**Objetivo:** Experiencia nativa, estricta adaptación al modelo 10-foot.
1. **DOM Virtualization (Windowing):** Implementar virtualización (ej. `@tanstack/react-virtual`) en la EPG y listas masivas de VOD para mantener un número fijo y mínimo de nodos en el DOM, sin importar el tamaño del catálogo.
2. **Navegación Nativa TV:** Estandarizar el mapeo de teclas físicas (WebOS Back / Tizen Return) contra el historial de navegación de `react-router-dom`, asegurando el cierre ordenado de modales antes de salir de la aplicación.
