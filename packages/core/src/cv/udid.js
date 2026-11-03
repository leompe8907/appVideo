/**
 * UDID del dispositivo por marca/cliente.
 */

import { getBrandItem, resolveBrandId, setBrandItem } from '../utils/brandStorage';

export function getUdid(brandId) {
  const brand = resolveBrandId(brandId);
  let udid = getBrandItem(brand, 'udid');
  if (!udid) {
    udid = generateUdid();
    setBrandItem(brand, 'udid', udid);
  }
  return udid;
}

function generateUdid() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `WEB-${timestamp}-${random}${random2}`.toUpperCase();
}

export default getUdid;
