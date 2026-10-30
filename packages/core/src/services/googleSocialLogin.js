/**
 * Intercambia el JWT de Google Identity por la respuesta del backend Django
 * (dj-rest-auth + panaccess_credentials).
 */

/**
 * @param {string} url - POST absoluto, ej. http://127.0.0.1:8000/wind/auth/google/
 * @param {string} idTokenJwt - credential JWT de Google Identity Services
 * @returns {Promise<Object>} Cuerpo JSON de la respuesta
 */
export async function exchangeGoogleCredentialWithBackend(url, idTokenJwt) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: idTokenJwt }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const err = new Error('Respuesta del servidor no es JSON válido.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const detail =
      (typeof data.detail === 'string' && data.detail) ||
      (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) ||
      (typeof data.message === 'string' && data.message) ||
      res.statusText ||
      'Error en autenticación con Google.';
    const err = new Error(detail);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
