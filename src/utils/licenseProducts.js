/**
 * Utilidades compartidas para smartcards/licencias y el campo `products`.
 */

export function getLicenseKey(license) {
  if (!license || typeof license !== 'object') return '';
  return String(
    license.KEY || license.key || license.licenseKey || license.Key || license.id || '',
  ).trim();
}

export function getLicensePin(license) {
  if (!license || typeof license !== 'object') return '';
  const pin = license.pin ?? license.PIN ?? license.Pin ?? license.licensePin ?? '';
  return pin != null ? String(pin) : '';
}

export function getLicenseProducts(license) {
  const products = license?.products;
  return typeof products === 'string' ? products : '';
}

export function licenseHasProducts(license) {
  return getLicenseProducts(license).trim() !== '';
}

export function anyLicenseHasProducts(licenses) {
  return Array.isArray(licenses) && licenses.some(licenseHasProducts);
}

/**
 * Candidatas para auto-activación: primero las que tienen products, luego el resto.
 */
export function getLicensesForAutoActivation(licenses) {
  if (!Array.isArray(licenses) || licenses.length === 0) return [];
  const valid = licenses.filter((license) => getLicenseKey(license));
  const withProducts = valid.filter(licenseHasProducts);
  const withoutProducts = valid.filter((license) => !licenseHasProducts(license));
  if (withProducts.length > 0) {
    return [...withProducts, ...withoutProducts];
  }
  return valid;
}

/**
 * Lista en SmartCardPage: prioriza licencias con products si existen.
 */
export function filterLicensesForDisplay(licenses) {
  if (!Array.isArray(licenses)) return [];
  const valid = licenses.filter((license) => getLicenseKey(license));
  const withProducts = valid.filter(licenseHasProducts);
  return withProducts.length > 0 ? withProducts : valid;
}

/**
 * Smartcards visibles en ProfilePage.
 */
export function filterProfileSmartCards(licenses) {
  if (!Array.isArray(licenses)) return [];
  return licenses.filter((card) => {
    const key = getLicenseKey(card);
    if (!key) return false;
    const products = card?.products;
    if (products !== undefined && products !== null) {
      return typeof products === 'string' && products.trim() !== '';
    }
    return true;
  });
}

export function findLicenseByKey(licenses, licenseKey) {
  const key = String(licenseKey || '').trim();
  if (!key || !Array.isArray(licenses)) return null;
  return licenses.find((license) => getLicenseKey(license) === key) || null;
}

/**
 * Indica si la licencia activa es apta para saltar /smartcard hacia home.
 */
export function isActiveLicenseUsableForHome(activeLicense, licenses) {
  const key = activeLicense?.licenseKey ? String(activeLicense.licenseKey).trim() : '';
  if (!key) return false;

  const match = findLicenseByKey(licenses, key);
  if (!match) return true;

  if (anyLicenseHasProducts(licenses)) {
    return licenseHasProducts(match);
  }

  return true;
}
