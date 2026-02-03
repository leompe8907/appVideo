/**
 * Genera un UDID único para el dispositivo
 * Compatible con TVs LG y Samsung 2016
 */

export function getUdid() {
  const storageKey = 'device_udid';
  
  // Intentar obtener UDID guardado
  let udid = localStorage.getItem(storageKey);
  
  if (!udid) {
    // Generar nuevo UDID
    udid = generateUdid();
    localStorage.setItem(storageKey, udid);
  }
  
  return udid;
}

function generateUdid() {
  // Formato: DEVICE-TIMESTAMP-RANDOM
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  
  return `WEB-${timestamp}-${random}${random2}`.toUpperCase();
}

export default getUdid;

