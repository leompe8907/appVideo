/**
 * `Date#toLocaleDateString(locale, options)` construye un `Intl.DateTimeFormat`
 * nuevo en cada llamada, y en un TV de 2020 eso cuesta ms por llamada (en
 * Catchup, una por tarjeta: hasta decenas de segundos con 422 tarjetas). Un
 * formateador por (idioma, opciones) se crea una vez y se reutiliza.
 */
const formatters = new Map();

export function getDateTimeFormatter(locale, options) {
  const key = `${locale || ''}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale || undefined, options);
    formatters.set(key, formatter);
  }
  return formatter;
}
