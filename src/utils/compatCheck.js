/**
 * Comprueba APIs mínimas antes de arrancar la SPA en TVs antiguas.
 * @returns {string[]} Lista de problemas detectados (vacía = OK)
 */
export function runCompatCheck() {
  const issues = [];
  if (typeof Promise === 'undefined') issues.push('Promise no soportado');
  if (typeof URL === 'undefined') issues.push('URL API no soportada');
  if (typeof Worker === 'undefined') issues.push('Web Workers no soportados');
  if (typeof fetch === 'undefined') issues.push('fetch no soportado');
  if (typeof Map === 'undefined') issues.push('Map no soportado');
  if (typeof Set === 'undefined') issues.push('Set no soportado');
  return issues;
}

/**
 * Muestra un mensaje de error en pantalla si faltan APIs críticas.
 * @param {string[]} issues
 */
export function showCompatError(issues) {
  if (!issues?.length || typeof document === 'undefined') return;
  const root = document.getElementById('root') || document.body;
  if (!root) return;
  root.innerHTML = [
    '<div style="font-family:sans-serif;padding:2rem;color:#fff;background:#111;min-height:100vh;">',
    '<h1 style="font-size:1.25rem;margin:0 0 1rem;">Dispositivo no compatible</h1>',
    '<p style="margin:0 0 1rem;opacity:0.9;">Este televisor o navegador no cumple los requisitos mínimos de la aplicación.</p>',
    '<ul style="margin:0;padding-left:1.25rem;">',
    ...issues.map((i) => `<li>${i}</li>`),
    '</ul>',
    '</div>',
  ].join('');
}
