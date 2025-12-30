/**
 * Hook para manejar la activación de licencias
 */

import { useState, useCallback } from 'react';
import licenseActivationService from '../services/licenseActivationService';

export function useLicenseActivation() {
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState(null);

  /**
   * Activa una licencia específica
   */
  const activateLicense = useCallback(async (licenseKey, pin, failIfInUse = false) => {
    setIsActivating(true);
    setActivationError(null);

    try {
      await licenseActivationService.activateLicense(licenseKey, pin, -1, failIfInUse);
      return true;
    } catch (error) {
      setActivationError(error.message || 'Error al activar licencia');
      throw error;
    } finally {
      setIsActivating(false);
    }
  }, []);

  /**
   * Activa licencias automáticamente
   */
  const autoActivateLicense = useCallback(async (index = 0) => {
    setIsActivating(true);
    setActivationError(null);

    try {
      await licenseActivationService.autoActivateLicense(index);
      return true;
    } catch (error) {
      setActivationError(error.message || 'Error en activación automática');
      throw error;
    } finally {
      setIsActivating(false);
    }
  }, []);

  /**
   * Login y activación en un solo flujo
   */
  const loginAndActivate = useCallback(async (username, password, automatic = true, license = null, pin = null) => {
    setIsActivating(true);
    setActivationError(null);

    try {
      await licenseActivationService.loginAndActivateLicense(username, password, automatic, false, license, pin);
      return true;
    } catch (error) {
      setActivationError(error.message || 'Error en login y activación');
      throw error;
    } finally {
      setIsActivating(false);
    }
  }, []);

  /**
   * Verifica sesión y reactiva si es necesario
   */
  const checkAndReactivate = useCallback(async (failIfInUse = false) => {
    setIsActivating(true);
    setActivationError(null);

    try {
      const result = await licenseActivationService.checkSessionAndReactivateIfNeeded(failIfInUse);
      return result;
    } catch (error) {
      setActivationError(error.message || 'Error verificando sesión');
      return false;
    } finally {
      setIsActivating(false);
    }
  }, []);

  return {
    isActivating,
    activationError,
    activateLicense,
    autoActivateLicense,
    loginAndActivate,
    checkAndReactivate,
    getLicenses: () => licenseActivationService.getLicenses(),
    getActiveLicense: () => licenseActivationService.getActiveLicense(),
  };
}

export default useLicenseActivation;

