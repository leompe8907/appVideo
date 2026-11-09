/**
 * @deprecated Este módulo fue renombrado a `deviceAuthService.js` (junto con
 * `login.windAuth` -> `login.deviceSession` en `brands.js`) porque el nombre
 * "wind" era demasiado específico: el contrato (`/api/auth/login/`,
 * `/api/auth/token/refresh/`, `/ws/device/`) lo implementa hoy el backend
 * Wind, pero está pensado para que cualquier brand pueda apuntarlo a otro
 * backend en el futuro.
 *
 * No queda nada importando este archivo -- se deja vacío (en vez de
 * eliminado, por una restricción del entorno de este sandbox al borrar
 * archivos en esta carpeta montada) solo como referencia histórica. Usar
 * `./deviceAuthService.js`.
 */
export {};
