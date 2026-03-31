/**
 * Configuración de i18n (internacionalización)
 * Idiomas: es (español), en (inglés), pt (portugués)
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';
import en from './en.json';
import pt from './pt.json';

const resources = {
  es: { translation: es },
  en: { translation: en },
  pt: { translation: pt },
};

// Detección de idioma: localStorage > navigator > fallback 'es'
const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('app_language');
    if (stored && (stored === 'es' || stored === 'en' || stored === 'pt')) return stored;
  } catch (_) {}
  const browser = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browser.startsWith('en')) return 'en';
  if (browser.startsWith('pt')) return 'pt';
  return 'es';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
