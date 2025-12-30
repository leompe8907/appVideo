/**
 * Utilidades para manejo de licencias
 */

/**
 * Formatea una clave (camelCase a Title Case)
 */
export function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Extrae la clave de licencia de un objeto
 */
export function extractLicenseKey(license) {
  return license?.KEY || license?.key || license?.licenseKey || license?.Key || '';
}

/**
 * Extrae el PIN de licencia de un objeto
 */
export function extractLicensePin(license) {
  return license?.pin || license?.PIN || license?.Pin || '';
}

/**
 * Normaliza una licencia a un formato estándar
 */
export function normalizeLicense(license) {
  const key = extractLicenseKey(license);
  const pin = extractLicensePin(license);

  return {
    KEY: key,
    key: key,
    licenseKey: key,
    pin: pin,
    PIN: pin,
    Pin: pin,
    ...license
  };
}

