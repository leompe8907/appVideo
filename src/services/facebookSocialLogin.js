/**
 * Facebook Login (Web): obtiene access_token y lo intercambia con el backend Django
 * (dj-rest-auth + panaccess_credentials).
 */

function loadFacebookSdkOnce() {
  if (window.FB) return Promise.resolve(window.FB);
  if (window.__fbSdkLoadingPromise) return window.__fbSdkLoadingPromise;

  window.__fbSdkLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk');
    if (existing) {
      // Si el script existe, esperar a que window.FB aparezca.
      const t = setInterval(() => {
        if (window.FB) {
          clearInterval(t);
          resolve(window.FB);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        if (window.FB) resolve(window.FB);
        else reject(new Error('No se pudo cargar Facebook SDK.'));
      }, 8000);
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onload = () => {
      if (window.FB) resolve(window.FB);
      else reject(new Error('Facebook SDK cargó pero FB no está disponible.'));
    };
    script.onerror = () => reject(new Error('No se pudo descargar Facebook SDK.'));
    document.body.appendChild(script);
  });

  return window.__fbSdkLoadingPromise;
}

async function ensureFbInitialized(appId) {
  const FB = await loadFacebookSdkOnce();
  if (!appId) throw new Error('Falta Facebook App ID.');

  // Evitar re-init con distinto App ID.
  if (window.__fbInitializedAppId === appId) return FB;

  FB.init({
    appId,
    cookie: true,
    xfbml: false,
    version: 'v20.0',
  });
  window.__fbInitializedAppId = appId;
  return FB;
}

/**
 * Abre el popup de Facebook y devuelve el access_token.
 * @param {string} appId
 * @returns {Promise<string>}
 */
export async function getFacebookAccessToken(appId) {
  const FB = await ensureFbInitialized(appId);
  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        const token = response?.authResponse?.accessToken;
        if (token) resolve(token);
        else reject(new Error('No se obtuvo access_token de Facebook.'));
      },
      { scope: 'public_profile,email' },
    );
  });
}

/**
 * POST `{ access_token }` al backend y devuelve JSON.
 * @param {string} url
 * @param {string} accessToken
 */
export async function exchangeFacebookAccessTokenWithBackend(url, accessToken) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
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
      'Error en autenticación con Facebook.';
    const err = new Error(detail);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

