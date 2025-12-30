/**
 * Servicio para manejar la activación automática de licencias
 * Basado en LoginHelper.js del proyecto antiguo
 */

import CryptoJS from 'crypto-js';
import panaccessService from './panaccessService';

class LicenseActivationService {
  constructor() {
    this.licenses = [];
    this.activationRecursive = false;
    this.activationFailIfInUse = true;
    this.maxAutoActivateLicense = 5; // Límite de intentos de activación automática
  }

  /**
   * Configura el servicio con licencias y opciones
   */
  configure(licenses = [], activationRecursive = false, activationFailIfInUse = true, maxAutoActivateLicense = 5) {
    this.licenses = licenses;
    this.activationRecursive = activationRecursive;
    this.activationFailIfInUse = activationFailIfInUse;
    this.maxAutoActivateLicense = maxAutoActivateLicense;

    // Guardar licencias en localStorage
    if (licenses && licenses.length > 0) {
      localStorage.setItem('cvLicenses', JSON.stringify(licenses));
    }
  }

  /**
   * Obtiene las licencias desde el servidor
   */
  async getLicenses() {
    try {
      const licenses = await panaccessService.getStreamingLicenses();
      this.licenses = licenses || [];
      
      // Guardar en localStorage
      if (this.licenses.length > 0) {
        localStorage.setItem('cvLicenses', JSON.stringify(this.licenses));
      }
      
      return this.licenses;
    } catch (error) {
      console.error('[LicenseActivation] Error obteniendo licencias:', error);
      throw error;
    }
  }

  /**
   * Login y activación de licencia en un solo flujo
   */
  async loginAndActivateLicense(username, password, automatic = true, hasLicenseCredentials = false, license = null, pin = null) {
    try {
      // 1. Hacer login
      await panaccessService.login('clientLogin', {
        clientId: username,
        pwd: password
      });

      // 2. Obtener licencias si no hay o no es automático
      if (this.licenses.length === 0 || !automatic) {
        await this.getLicenses();
        hasLicenseCredentials = this.licenses.length > 0;
      }

      // 3. Obtener configuración del cliente
      await panaccessService.getClientConfig();

      // 4. Verificar si hay credenciales de licencia
      // Usar configuración del brand si está disponible
      const brandConfig = panaccessService.brandConfig;
      const licenseConfig = brandConfig?.licenseActivation || {};
      const automaticActivation = licenseConfig.automaticActivation || brandConfig?.automaticActivation || false;

      if (!hasLicenseCredentials || (!automaticActivation && !license)) {
        throw new Error('No hay credenciales de licencia disponibles');
      }

      // 5. Configurar opciones desde brandConfig
      if (brandConfig) {
        this.activationRecursive = licenseConfig.activationRecursive ?? this.activationRecursive;
        this.activationFailIfInUse = licenseConfig.activationFailIfInUse ?? this.activationFailIfInUse;
        this.maxAutoActivateLicense = licenseConfig.maxAutoActivateLicense ?? this.maxAutoActivateLicense;
      }

      // 6. Si se proporciona una licencia específica, moverla al inicio
      if (license) {
        this.changeFirstLicense(license, pin);
      }

      // 7. Activar licencia automáticamente
      await this.autoActivateLicense(0);

      return true;
    } catch (error) {
      console.error('[LicenseActivation] Error en loginAndActivateLicense:', error);
      throw error;
    }
  }

  /**
   * Cambia la primera licencia en el array
   */
  changeFirstLicense(license, pin) {
    if (this.licenses.length === 0) {
      return;
    }

    // Si ya es la primera, no hacer nada
    const firstLicense = this.licenses[0];
    const licenseKey = firstLicense?.KEY || firstLicense?.key || firstLicense?.licenseKey || '';
    if (licenseKey === license) {
      return;
    }

    // Filtrar la licencia actual y ponerla al inicio
    const filtered = this.licenses.filter((item) => {
      const itemKey = item.KEY || item.key || item.licenseKey || '';
      return itemKey !== license;
    });

    const licenseObj = {
      KEY: license,
      key: license,
      licenseKey: license,
      pin: pin || '',
      PIN: pin || '',
      Pin: pin || ''
    };

    this.licenses = [licenseObj, ...filtered];
  }

  /**
   * Intenta activar licencias automáticamente en orden
   */
  async autoActivateLicense(index = 0) {
    // Verificar límites
    if (index >= this.licenses.length || index > this.maxAutoActivateLicense || (index > 0 && !this.activationRecursive)) {
      throw new Error('No se pudo activar ninguna licencia automáticamente');
    }

    const license = this.licenses[index];
    if (!license) {
      // Intentar con la siguiente
      return this.autoActivateLicense(index + 1);
    }

    const licenseKey = license.KEY || license.key || license.licenseKey || '';
    const pin = license.pin || license.PIN || license.Pin || '';

    // Si no hay key o pin, intentar siguiente
    if (!licenseKey || !pin) {
      return this.autoActivateLicense(index + 1);
    }

    console.log(`[LicenseActivation] Intentando activar licencia ${licenseKey} (índice ${index})`);

    try {
      await this.activateLicense(licenseKey, pin, index);
      return true;
    } catch (error) {
      console.warn(`[LicenseActivation] Error activando licencia ${licenseKey}:`, error);
      // Intentar con la siguiente licencia
      return this.autoActivateLicense(index + 1);
    }
  }

  /**
   * Activa una licencia específica
   */
  async activateLicense(licenseKey, pin, index = -1, failIfInUse = null) {
    try {
      // Guardar licencia a activar
      localStorage.setItem('cvLicenseToActivate', licenseKey);

      // Usar failIfInUse proporcionado o el configurado
      const shouldFailIfInUse = failIfInUse !== null ? failIfInUse : this.activationFailIfInUse;

      // Activar licencia
      await panaccessService.activateStreamingLicense(
        licenseKey,
        pin,
        shouldFailIfInUse
      );

      console.log(`[LicenseActivation] Licencia activada exitosamente: ${licenseKey} (índice: ${index})`);

      // Obtener configuración nuevamente para actualizar parámetros
      try {
        await panaccessService.getClientConfig();
        console.log('[LicenseActivation] Configuración actualizada después de activación');
      } catch (error) {
        console.warn('[LicenseActivation] Error obteniendo configuración después de activación:', error);
        // No es crítico, continuar
      }

      return true;
    } catch (error) {
      console.error(`[LicenseActivation] Error activando licencia ${licenseKey}:`, error);
      throw error;
    }
  }

  /**
   * Verifica sesión y reactiva licencia si es necesario
   */
  async checkSessionAndReactivateIfNeeded(failIfInUse = false) {
    try {
      // Verificar si el usuario está logueado
      const client = panaccessService.getClient();
      if (!client) {
        throw new Error('Cliente no inicializado');
      }

      const isLoggedIn = await client.loggedIn();
      
      if (isLoggedIn) {
        console.log('[LicenseActivation] Usuario está logueado, reactivando licencia');
        return await this.reactivateLicense(failIfInUse);
      } else {
        console.log('[LicenseActivation] Usuario no está logueado, reactivando sesión y licencia');
        return await this.reactivateSession();
      }
    } catch (error) {
      console.warn('[LicenseActivation] Error verificando sesión:', error);
      // Intentar reactivar sesión
      return await this.reactivateSession();
    }
  }

  /**
   * Reactiva una licencia existente
   */
  async reactivateLicense(failIfInUse = false) {
    try {
      const license = localStorage.getItem('cvLicense');
      const pin = localStorage.getItem('cvLicensePin');

      if (!license || !pin) {
        throw new Error('No hay licencia guardada para reactivar');
      }

      await panaccessService.activateStreamingLicense(license, pin, failIfInUse);
      console.log('[LicenseActivation] Licencia reactivada exitosamente');
      return true;
    } catch (error) {
      console.error('[LicenseActivation] Error reactivando licencia:', error);
      return false;
    }
  }

  /**
   * Reactiva sesión y licencia desde credenciales guardadas
   */
  async reactivateSession() {
    try {
      const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'default-secret-key-change-me';

      // Obtener credenciales guardadas
      const encryptedUsername = localStorage.getItem('username');
      const encryptedPassword = localStorage.getItem('password');
      const licensesJson = localStorage.getItem('cvLicenses');
      const license = localStorage.getItem('cvLicense');
      const pin = localStorage.getItem('cvLicensePin');

      if (!encryptedUsername || !encryptedPassword) {
        throw new Error('No hay credenciales guardadas');
      }

      // Desencriptar credenciales
      const username = CryptoJS.AES.decrypt(encryptedUsername, SECRET_KEY).toString(CryptoJS.enc.Utf8);
      const password = CryptoJS.AES.decrypt(encryptedPassword, SECRET_KEY).toString(CryptoJS.enc.Utf8);

      if (!username || !password) {
        throw new Error('Credenciales inválidas');
      }

      // Parsear licencias
      let licenses = [];
      if (licensesJson) {
        try {
          licenses = JSON.parse(licensesJson);
        } catch (e) {
          console.warn('[LicenseActivation] Error parseando licencias guardadas');
        }
      }

      const hasLicenseCredentials = licenses.length > 0 || (license && pin);

      // Configurar servicio
      this.configure(licenses, true, false);

      // Login y activar licencia
      await this.loginAndActivateLicense(username, password, true, hasLicenseCredentials, license, pin);
      
      console.log('[LicenseActivation] Sesión y licencia reactivadas exitosamente');
      return true;
    } catch (error) {
      console.error('[LicenseActivation] Error reactivando sesión:', error);
      return false;
    }
  }

  /**
   * Obtiene las licencias actuales
   */
  getLicenses() {
    return this.licenses;
  }

  /**
   * Obtiene la licencia activa
   */
  getActiveLicense() {
    const license = localStorage.getItem('cvLicense');
    const pin = localStorage.getItem('cvLicensePin');
    
    if (!license) {
      return null;
    }

    return {
      key: license,
      KEY: license,
      licenseKey: license,
      pin: pin || '',
      PIN: pin || '',
      Pin: pin || ''
    };
  }
}

// Instancia singleton
const licenseActivationService = new LicenseActivationService();

export default licenseActivationService;

