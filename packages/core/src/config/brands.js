/**
 * Configuración de marcas (brands) de la aplicación.
 *
 * Cada objeto de marca define:
 *
 * @param {string} brand - Identificador único de la marca (slug), usado para seleccionar la configuración activa.
 * @param {string} appName - Nombre visible de la aplicación que se muestra en la UI.
 * @param {string} drm - URL base del servicio DRM/backend (ej. Panaccess, inTV) para autenticación y contenido.
 *   Placeholder '' en este archivo -- se resuelve en build/runtime desde VITE_BRAND_DRM_<MARCA> en .env.local
 *   (mismo mecanismo que `token`, ver resolveBrandToken.js/applyBrandRuntimePolicy.js). No hardcodear acá:
 *   scripts/check-brand-secrets.js falla el build si detecta un literal no vacío.
 * @param {string} token - Token de API o clave para autenticar las peticiones contra el servicio DRM.
 * @param {string} developedBy - Texto o HTML del crédito "Desarrollado por" (puede incluir entidades como &#174).
 * @param {string} version - Número de versión de la app para esta marca (ej. "1.0.2", "2.0.2").
 *
 * @param {Object} ui - Configuración de interfaz y tema:
 *   @param {number} ui.splashDuration - Tiempo en milisegundos que se muestra la pantalla de splash al iniciar.
 *   @param {boolean} ui.splashAnimado - true: usa imagen animada (.gif o video); false: usa imagen estática (.png/.webp/.jpg).
 *   @param {string|boolean} [ui.splashVideo] - Nombre del archivo de video para splash (ej: 'splash.mp4'). Solo aplica si splashAnimado es true. Si es true usa 'splash.mp4' por defecto.
 *   @param {string} ui.epgLineColorTime - Color (hex) de la línea de tiempo actual en la guía de programación (EPG).
 *   @param {string} ui.primaryColor - Color principal de la marca (botones, acentos, etc.).
 *   @param {string} ui.secondaryColor - Color secundario (hover, fondos, etc.).
 *   @param {string} ui.theme - Tema global: "dark" o "light".
 *   @param {string} ui.fontFamily - Familia de fuentes CSS (ej. "Arial, sans-serif", "Roboto, sans-serif").
 *   @param {Object} ui.sidebar - Configuración visual del sidebar Home.
 *     @param {string} ui.sidebar.backgroundColor - Fondo del sidebar.
 *     @param {string} ui.sidebar.textColor - Color del texto del sidebar.
 *     @param {string} ui.sidebar.submenuBackgroundColor - Fondo del submenú desplegable.
 *     @param {string} ui.sidebar.submenuTextColor - Color del texto del submenú desplegable.
 *     @param {boolean} ui.sidebar.fixed - true: sidebar sticky/fijo; false: normal (fluye con layout).
 *     @param {boolean} [ui.sidebar.showClientName=true] - Muestra el nombre del cliente en la cabecera del sidebar.
 *     @param {string} [ui.sidebar.clientName] - Texto personalizado; por defecto usa appName.
 *   @param {Object} ui.playerLoading - Estilo del overlay de carga de reproducción.
 *     @param {boolean} ui.playerLoading.premium - true: overlay premium (blur + gradientes + glow); false: overlay simple.
 *   @param {Object} [ui.search] - Tema de la pantalla Buscador (/home/buscador). Opcional; sin definir usa defaults en CSS.
 *     @param {string} [ui.search.overlayBg] - Fondo del overlay detrás del panel.
 *     @param {string} [ui.search.panelBg] - Fondo del panel principal.
 *     @param {Object} [ui.search.header] - Barra superior (input + limpiar).
 *       @param {string} [ui.search.header.bg] - Fondo de la barra.
 *       @param {string} [ui.search.header.text] - Color de texto en la barra.
 *     @param {Object} [ui.search.input] - Campo de búsqueda.
 *       @param {string} [ui.search.input.bg] - Fondo del input.
 *       @param {string} [ui.search.input.text] - Color del texto.
 *       @param {string} [ui.search.input.placeholder] - Color del placeholder.
 *       @param {string} [ui.search.input.focusedBg] - Fondo al enfocar.
 *       @param {string} [ui.search.input.focusedBorder] - Borde al enfocar (default: --focus-color).
 *       @param {string} [ui.search.input.focusedShadow] - Sombra/box-shadow al enfocar.
 *     @param {Object} [ui.search.clearButton] - Botón limpiar.
 *       @param {string} [ui.search.clearButton.bg] - Fondo.
 *       @param {string} [ui.search.clearButton.text] - Texto.
 *       @param {string} [ui.search.clearButton.hoverBg] - Fondo en hover/foco.
 *     @param {Object} [ui.search.tabs] - Pestañas de filtro (Todos, TV, VOD…).
 *       @param {string} [ui.search.tabs.bg] - Fondo inactivo.
 *       @param {string} [ui.search.tabs.text] - Texto inactivo.
 *       @param {string} [ui.search.tabs.hoverBg] - Fondo hover/foco inactivo.
 *       @param {string} [ui.search.tabs.activeBg] - Fondo activo (default: --primary-color).
 *       @param {string} [ui.search.tabs.activeText] - Texto activo.
 *       @param {string} [ui.search.tabs.activeHoverBg] - Fondo activo en hover/foco.
 *     @param {Object} [ui.search.results] - Área y tarjetas de resultados.
 *       @param {string} [ui.search.results.areaBg] - Fondo del contenedor scroll.
 *       @param {string} [ui.search.results.cardBg] - Fondo de cada tarjeta.
 *       @param {string} [ui.search.results.cardBorder] - Borde de tarjeta.
 *       @param {string} [ui.search.results.cardHoverBg] - Fondo tarjeta hover/foco.
 *       @param {string} [ui.search.results.cardFocusBorder] - Borde tarjeta hover/foco (default: --focus-color).
 *       @param {string} [ui.search.results.titleText] - Títulos y nombres.
 *       @param {string} [ui.search.results.metaText] - Metadatos secundarios (hora, actor, etc.).
 *       @param {string} [ui.search.results.sectionTitleBg] - Fondo del título de sección (tab Todos).
 *       @param {string} [ui.search.results.thumbBg] - Fondo de miniatura/placeholder.
 *     @param {Object} [ui.search.empty] - Estados vacíos y contador.
 *       @param {string} [ui.search.empty.text] - Mensaje sin resultados.
 *       @param {string} [ui.search.empty.countText] - Texto del contador de resultados.
 *
 * @param {Object} features - Funcionalidades activas o no para esta marca:
 *   @param {boolean} features.profiles - true: tras login redirige a /profile; false: redirige a /smartcard.
 *   @param {boolean} features.showRating - true: muestra la clasificación/rating de contenido; false: la oculta.
 *   @param {boolean} features.osms - true: habilita la integración OSMS y su menú; false: la deshabilita.
 *   @param {boolean} [features.osmsInline=false] - Solo aplica si features.osms es true. true: "Mensajes"
 *     se muestra inline dentro de Mi Cuenta, en el mismo panel al lado del submenú (igual que Cambiar
 *     contraseña / Dispositivos vinculados / Eliminar cuenta), sin cambiar de pantalla. false (default,
 *     comportamiento actual): "Mensajes" navega a /home/osms como módulo independiente.
 *   @param {boolean} [features.playerVolumeControls=false] - true: el HUD del reproductor muestra un botón
 *     de mute + un slider de volumen (solo web/PC -- en TV el volumen lo maneja el control remoto físico,
 *     este control no se muestra ahí). false (default, comportamiento actual): sin control de volumen en
 *     el HUD. El volumen/mute elegido se recuerda entre sesiones (localStorage, por marca).
 *   @param {boolean} [features.playerChannelArrows=false] - true: agrega flechas de "canal anterior" /
 *     "canal siguiente" flotando sobre el video (solo web/PC -- en TV el cambio de canal ya lo maneja el
 *     control remoto vía CH+/CH-). Reutiliza la misma lógica de zapping que el teclado/control remoto
 *     (usePlayerChannelZapping), no hay lógica nueva de selección de canal. false (default, comportamiento
 *     actual): sin flechas en el HUD.
 *
 * @param {Object} login - Bloque unificado de configuración del Login por marca.
 *   @param {Object} login.theme - Colores y estilos del formulario (CSS: hex, rgba, gradiente o var(--primary-color)).
 *     @param {string} login.theme.cardBackground - Fondo de la tarjeta central del formulario.
 *     @param {string} login.theme.submitBg - Fondo del botón principal "Entrar".
 *     @param {string} login.theme.submitText - Color del texto del botón "Entrar".
 *     @param {string} login.theme.registerBg - Fondo del botón "Registrarse" (QR).
 *     @param {string} login.theme.registerText - Color del texto del botón "Registrarse".
 *     @param {string} login.theme.udidBg - Fondo del botón "Login UDID".
 *     @param {string} login.theme.udidText - Color del texto del botón UDID.
 *     @param {string} login.theme.toggleBg - Fondo del botón mostrar/ocultar contraseña.
 *     @param {string} login.theme.toggleText - Color del texto del toggle de contraseña.
 *     @param {Object} login.theme.inputs - Campos usuario/contraseña.
 *       @param {string} login.theme.inputs.bg - Fondo de los campos.
 *       @param {string} login.theme.inputs.border - Borde de los campos.
 *       @param {string} login.theme.inputs.text - Color del texto escrito.
 *       @param {string} login.theme.inputs.placeholder - Color del placeholder (--login-input-placeholder).
 *       @param {string|null} login.theme.inputs.focusedBg - Fondo con foco (TV/teclado).
 *       @param {string|null} login.theme.inputs.focusedBorder - Borde con foco; null = ui.primaryColor.
 *       @param {string|null} login.theme.inputs.focusedShadow - Sombra con foco; null = anillo primaryColor.
 *     @param {Object} login.theme.social - Botones Google/Facebook (fallback custom).
 *       @param {string} login.theme.social.bg - Fondo de botones sociales.
 *       @param {string} login.theme.social.border - Borde de botones sociales.
 *       @param {string} login.theme.social.text - Texto de botones sociales.
 *     @param {string} login.theme.modalCloseBg - Fondo del botón cerrar modal QR/UDID.
 *     @param {string} login.theme.modalCloseText - Texto del botón cerrar modal.
 *     @param {string|null} login.theme.linkColor - Color enlaces (olvidé contraseña, suscríbete); null = ui.primaryColor.
 *     @param {string} login.theme.dividerColor - Color línea del separador "o" antes de login social.
 *     @param {Object} login.theme.forgotPasswordModal - Modal "Recuperar contraseña" nativo (PC/web, con formulario de correo; no confundir con el QR de TV).
 *       @param {string} login.theme.forgotPasswordModal.background - Fondo de la tarjeta del modal.
 *       @param {string} login.theme.forgotPasswordModal.borderColor - Borde de la tarjeta del modal.
 *       @param {string} login.theme.forgotPasswordModal.titleColor - Color del título.
 *       @param {string} login.theme.forgotPasswordModal.textColor - Color del texto descriptivo.
 *       @param {string} login.theme.forgotPasswordModal.iconBg - Fondo del círculo de icono (estado normal, candado).
 *       @param {string} login.theme.forgotPasswordModal.iconColor - Color del icono (estado normal).
 *       @param {string} login.theme.forgotPasswordModal.successIconBg - Fondo del círculo de icono (estado de éxito, check).
 *       @param {string} login.theme.forgotPasswordModal.successIconColor - Color del icono (estado de éxito).
 *       @param {string} login.theme.forgotPasswordModal.inputIconColor - Color del icono de sobre dentro del campo de correo.
 *   @param {Object} login.backgroundImage - Imagen de fondo de pantalla completa.
 *     @param {boolean} login.backgroundImage.enabled - true: usa assetPath; false: assets.background o background.png.
 *     @param {string} login.backgroundImage.assetPath - Archivo en la carpeta de assets de la marca.
 *   @param {Object} login.qrRegister - Registro por QR en Login:
 *     @param {boolean} login.qrRegister.enabled - Habilita/deshabilita el botón/modal de registro QR.
 *     @param {string} login.qrRegister.url - URL destino codificada en el QR.
 *   @param {Object} login.forgotPassword - Enlace "Olvidé contraseña":
 *     @param {boolean} login.forgotPassword.enabled - Muestra enlace debajo del campo contraseña.
 *     @param {string} login.forgotPassword.url - URL destino al hacer clic; vacío = no navega.
 *   @param {Object} login.udid - Login por UDID:
 *     @param {boolean} login.udid.enabled - Habilita/deshabilita el login externo por UDID.
 *     @param {string} login.udid.baseUrl - Base HTTP del backend UDID.
 *     @param {string} login.udid.requestPath - Path POST para solicitar código UDID (recomendado: /udid/request-udid-manual/).
 *     @param {string} login.udid.wsUrl - WebSocket para recibir credenciales cifradas.
 *     @param {string} login.udid.appType - Tipo de app enviado al backend (ej. "10foot", "web").
 *     @param {string} login.udid.appVersion - Versión enviada al backend.
 *     @param {number} login.udid.maxReconnectAttempts - Reintentos máximos de reconexión WebSocket.
 *     @param {number[]} login.udid.reconnectMs - Delays entre reintentos (ms).
 *     @param {number} login.udid.heartbeatMs - Intervalo de ping WebSocket (ms).
 *     @param {string} login.udid.privateKeyUrl - Ruta pública PEM para descifrar encrypted_credentials; vacío = deshabilitado.
 *   @param {Object} login.socialLogin - Login social (Google / Facebook) por marca:
 *     @param {string} login.socialLogin.backendBaseUrl - Base común del backend; alternativa: VITE_SOCIAL_AUTH_BASE_URL.
 *     @param {Object} login.socialLogin.google - Google Identity + POST OAuth.
 *       @param {boolean} login.socialLogin.google.enabled - Muestra el botón (solo escritorio; en TV se oculta).
 *       @param {string} login.socialLogin.google.redirectUrl - URL absoluta del POST o path relativo a la base.
 *       @param {string} login.socialLogin.google.accessToken - Google OAuth client_id; alternativa: VITE_GOOGLE_CLIENT_ID.
 *       @param {boolean} login.socialLogin.google.preferCustomButton - true: botón custom con theme.social; false: widget GIS nativo.
 *       @param {string} login.socialLogin.google.backendBaseUrl - Base solo para Google; vacío = socialLogin.backendBaseUrl.
 *     @param {Object} login.socialLogin.facebook - Misma forma que google (enabled, redirectUrl, accessToken, backendBaseUrl).
 *   @param {Object} [login.deviceSession] - "Dispositivos vinculados" (Fase 3) -- opt-in, ver
 *     `services/deviceAuthService.js` y `services/deviceSessionService.js`. Nombre genérico a
 *     propósito: hoy solo lo implementa el backend Wind, pero cualquier brand podría apuntarlo
 *     a otro backend que hable el mismo contrato.
 *     @param {boolean} login.deviceSession.enabled - true: además de `clientLogin` (PanAccess), el
 *       login (manual, social o TV pareada) también autentica contra `{base}/api/auth/login/`
 *       del backend configurado para obtener un JWT, y registra este dispositivo por WebSocket
 *       (`/ws/device/`) para que aparezca en el panel de "dispositivos vinculados" del usuario.
 *       Si es false (default), ningún archivo de este módulo hace una llamada de red.
 *     @param {string} [login.deviceSession.baseUrl] - Base HTTP del backend; si se omite, se
 *       reutiliza `login.socialLogin.backendBaseUrl` y luego `login.udid.baseUrl`.
 *     @param {string} [login.deviceSession.wsUrl] - `wss://.../ws/device/` explícita; si se omite,
 *       se deriva de la base HTTP resuelta arriba (http->ws, https->wss) + `/ws/device/`.
 *     @param {string} [login.deviceSession.changePasswordFlow='otp'] - Qué flujo usa
 *       `ChangePasswordPanel.jsx` para "cambiar contraseña" (2026-09-14, ver
 *       docs/CAMBIO_CONTRASENA_OTP_2026-09-14.md en Back-Wind-V2): 'otp' (código de
 *       verificación de 6 dígitos por correo, sin pedir la contraseña actual) u
 *       'old_password' (formulario original: contraseña actual + nueva). El backend
 *       mantiene los dos endpoints activos siempre para cualquier marca -- este
 *       parámetro solo decide qué UI se muestra, no depende de ningún flag del
 *       backend. Default 'otp' si se omite.
 *
 * @param {boolean} hashPasswordBeforeLogin - true: hashear contraseña en cliente antes de enviar (ej. Panaccess);
 *   false: enviar contraseña en claro (ej. backends como intv).
 *
 * @param {Object} bouquets - Configuración visual específica para bouquets:
 *   @param {string} bouquets.timeshipColor - Color (hex) de la barra de progreso (timeship) en los bouquets.
 *
 * @param {Object} header - Cabecera de la pantalla Inicio (tres zonas horizontales: izquierda, centro, derecha).
 *   @param {Object} header.areas - Configuración por área (izq/centro/der).
 *     @param {Object} header.areas.left
 *     @param {Object} header.areas.center
 *     @param {Object} header.areas.right
 *       @param {boolean} header.areas.<area>.enabled - Habilita el área.
 *       @param {boolean} header.areas.<area>.showLogo - Muestra logo de la marca.
 *       @param {boolean} header.areas.<area>.showTime - Muestra hora del dispositivo.
 *       @param {'left'|'center'|'right'} header.areas.<area>.contentAlign - Alineación interna del contenido dentro del área.
 *   @param {Object} header.subheader - Sub-área debajo del header (3 columnas iguales).
 *     @param {Object} header.subheader.areas
 *       @param {Object} header.subheader.areas.<area>
 *         @param {boolean} header.subheader.areas.<area>.enabled
 *         @param {boolean} header.subheader.areas.<area>.showServiceInfo - Muestra info del canal enfocado (evento actual + siguiente).
 *         @param {'left'|'center'|'right'} header.subheader.areas.<area>.contentAlign - Alineación interna del contenido dentro del área.
 *
 * @param {Object} homeShell - Flags de UI por sección dentro de /home:
 *   @param {Object} homeShell.header - Habilita/deshabilita el header por módulo.
 *     @param {boolean} homeShell.header.inicio
 *     @param {boolean} homeShell.header.serviciosTvRadio
 *     @param {boolean} homeShell.header.vod
 *     @param {boolean} homeShell.header.catchup
 *   @param {Object} homeShell.ads - Habilita/deshabilita publicidad por módulo.
 *     Nota: por requerimiento actual, por defecto solo se activa en Inicio.
 *     @param {boolean} homeShell.ads.inicio
 *     @param {boolean} homeShell.ads.serviciosTvRadio
 *     @param {boolean} homeShell.ads.vod
 *     @param {boolean} homeShell.ads.catchup
 *
 * @param {Object} debug - Opciones de depuración (normalmente solo en desarrollo):
 *   @param {boolean} debug.spatialNav - true: activa logs en consola de la navegación espacial.
 *   @param {boolean} debug.spatialNavVisual - true: muestra marcos rojos de debug para la navegación espacial.
 *
 * @param {Object} vod - Configuración de la sección VOD:
 *   @param {string} vod.layout - Diseño de lista y detalle VOD: "hero" (actual, estilo Netflix/Disney+) | "classic" (estilo 10foot: mitad poster/info, abajo similar, series con episodios). Default: "hero".
 *   @param {Object} vod.vodDetail - Opciones del modal de detalle VOD (película/serie). Solo aplica cuando vod.layout === "hero".
 *     @param {number} vod.vodDetail.descriptionMaxLength - Caracteres máximos de la descripción antes de "Leer más" (0 = sin límite). Default: 180.
 *     @param {boolean} vod.vodDetail.showReleaseYear - Mostrar año de estreno en la metadata. Default: true.
 *     @param {boolean} vod.vodDetail.showDuration - Mostrar duración (min) en la metadata. Default: true.
 *     @param {boolean} vod.vodDetail.showParentalRating - Mostrar badge de clasificación por edades. Default: true.
 *     @param {boolean} vod.vodDetail.showCategories - Mostrar etiquetas de categorías. Default: true.
 *     @param {boolean} vod.vodDetail.showStarRating - Mostrar valoración en estrellas. Default: true (respeta features.showRating si existe).
 *     @param {boolean} vod.vodDetail.showDescription - Mostrar bloque de descripción. Default: true.
 *     @param {string|null} vod.vodDetail.playButtonColor - Color del botón Reproducir (hex/css). null = usar ui.primaryColor. Default: null.
 *     @param {string|null} vod.vodDetail.starRatingColor - Color de las estrellas rellenas (hex/css). null = usar playButtonColor o #e50914. Default: null.
 *     @param {number} vod.vodDetail.heroGradientOpacity - Opacidad del gradiente inferior del hero (0–1). Default: 0.95.
 *     @param {number} vod.vodDetail.posterWidthMin - Ancho mínimo del poster en px. Default: 100.
 *     @param {number} vod.vodDetail.posterWidthMax - Ancho máximo del poster en px. Default: 200.
 *     @param {string} vod.vodDetail.categoryTagBackground - Color/fondo de las etiquetas de categoría (css). Default: "rgba(255, 255, 255, 0.12)".
 *     @param {string} vod.vodDetail.categoryTagBorderColor - Borde de las etiquetas de categoría (css). Default: "rgba(255, 255, 255, 0.2)".
 *     @param {string} vod.vodDetail.parentalBadgeBorderColor - Borde del badge de clasificación por edades (css). Default: "rgba(255, 255, 255, 0.5)".
 *     @param {string} vod.vodDetail.contentPosition - Posición vertical del bloque de contenido (poster + info): "top" | "middle" | "bottom". Default: "bottom".
 *
 * @param {Object} parental - Configuración de Control Parental por marca:
 *   @param {number} parental.parentalControlMultiTtlMs - TTL (ms) para unlock temporal global cuando en el bouquet hay 2+ canales
 *     con `parentalControl:true`. Default: 40 minutos.
 *
 * @param {Object} EPG - Configuración de EPG por marca (guía + cards):
 *   @param {boolean} [EPG.enabled=true] - false: oculta TODO acceso a la guía completa (link del menú/Sidebar,
 *     botón del player, tab "EPG" del buscador, y bloquea /home/epg y el alias legacy /epg por URL directa).
 *     El ícono de "info" del evento actual en el player (que muestra datos del EPG pero no navega a la guía)
 *     NO está gateado por este flag. true (default): comportamiento actual, sin cambios.
 *   @param {number} EPG.daysOffset
 *   @param {number} EPG.hoursLimit
 *   @param {string} EPG.epgLineColorTime - Color guía (alineado con ui.epgLineColorTime de la marca).
 *   @param {number} EPG.reminderLeadSeconds - Segundos antes de start para popup de recordatorio. Default: 60.
 *   @param {boolean} EPG.reminderShowWhilePlaying - Si true, el popup puede mostrarse con playback activo.
 *   @param {boolean} EPG.epgPast
 *   @param {boolean} EPG.epgPagesPastEnabled
 *   @param {string} EPG.epgCardsChannelActiveBg
 *   @param {string} [EPG.epgCardsHeaderBg]
 *   @param {string} EPG.epgCardsProgramLiveBg
 *   @param {string} EPG.epgCardsProgramLiveProgressBg
 *   @param {boolean} EPG.epgCardsLaterGlobal
 *   @param {boolean|'auto'} EPG.epgCloseModalOnPlayLive
 *
 * NOTA (2026-09-14): este archivo antes tenía las 7 marcas como un único
 * array literal de ~3000 líneas -- cada una repitiendo ~90% de los mismos
 * parámetros, lo que hacía cualquier cambio puntual (ej. un color de UNA
 * marca) riesgoso de tocar sin querer la de al lado. Ahora `BRANDS` se arma
 * en `./brands/index.js` importando cada marca desde su propio archivo
 * (`./brands/<slug>.js`) -- cada uno tiene TODOS los parámetros completos y
 * explícitos (a pedido explícito: se prefirió esto en vez de un merge con
 * una base compartida, para que abrir el archivo de una marca muestre su
 * configuración real sin tener que ir a buscar qué hereda de otro lado).
 * `./brands/defaults.js` NO se usa en runtime -- quedó solo como plantilla
 * de referencia para dar de alta una marca nueva. Verificado por igualdad
 * estructural exacta contra el array anterior a este cambio -- ningún valor
 * resuelto cambió para ninguna marca. Para agregar/editar una marca, tocar
 * solo su archivo en `./brands/`.
 */
import { applyBrandRuntimePolicy } from './applyBrandRuntimePolicy.js';
import { BRANDS } from './brands/index.js';

export { BRANDS };

/**
 * Obtiene la configuración de una marca por su identificador.
 * @param {string} brandName - Identificador de la marca (ej. "bromteck", "intv", "gigmax").
 * @returns {Object|null} Objeto de configuración de la marca o null si no existe.
 */
export function getBrandConfig(brandName) {
  const brand = BRANDS.find((b) => b.brand === brandName);
  if (!brand) return null;

  const resolved = applyBrandRuntimePolicy(brand);
  if (!resolved.token && import.meta.env.PROD) {
    console.warn(
      `[brands] Token no configurado para "${brand.brand}". ` +
        `Define VITE_BRAND_TOKEN_${String(brand.brand).toUpperCase()} en .env.local`,
    );
  }

  return resolved;
}
