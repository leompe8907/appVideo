import {getActiveBrandConfig} from '@appvideo/core/config/brandConfig';
import {brandAssets} from './brandAssets';

/**
 * Tema de la marca leído de `brands/*.js` (lo mismo que la web aplica como
 * variables CSS en `applyTheme`, src/utils/config.js). Ver docs/VEGA_DESIGN_SPEC.md §6.
 */

/** `var(--primary-color, #667eea)` → color de la marca (o el fallback). */
function resolveCssColor(value, vars) {
  if (typeof value !== 'string') return value;
  return value.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)/gi, (_, name, fallback) =>
    vars[name] || (fallback ? fallback.trim() : ''),
  );
}

/** `linear-gradient(135deg, A 0%, B 100%)` → {angle, stops: [{color, offset}]}; color sólido → null. */
export function parseLinearGradient(value) {
  const m = /^\s*linear-gradient\((.*)\)\s*$/i.exec(value || '');
  if (!m) return null;
  const parts = m[1].split(/,(?![^(]*\))/).map((p) => p.trim());
  let angle = 180;
  if (/deg$/.test(parts[0])) angle = parseFloat(parts.shift());
  const stops = parts.map((p, i) => {
    const sm = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(p);
    return {color: sm[1].trim(), offset: sm[2] != null ? Number(sm[2]) / 100 : i / Math.max(1, parts.length - 1)};
  });
  return {angle, stops};
}

export function getTheme() {
  const brand = getActiveBrandConfig();
  const ui = brand?.ui || {};
  const login = brand?.login?.theme || {};
  const inputs = login.inputs || {};
  const primary = ui.primaryColor || '#667eea';
  const secondary = ui.secondaryColor || '#764ba2';
  const vars = {'--primary-color': primary, '--secondary-color': secondary};
  const color = (v, fallback) => resolveCssColor(v, vars) || fallback;

  return {
    brandId: brand?.brand,
    appName: brand?.appName || 'appVideo',
    logo: brandAssets.logo,
    assets: brandAssets,
    primary,
    secondary,
    focusColor: ui.focus?.color || secondary || primary,
    splashDurationMs: Number(ui.splashDuration) || 0,
    background: '#000',
    surface: 'rgba(255,255,255,0.06)',
    surfaceFocused: 'rgba(255,255,255,0.18)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.65)',
    focusBorder: '#ffffff',
    error: '#ff6b7a',
    sidebar: {
      background: ui.sidebar?.backgroundColor || primary,
      text: ui.sidebar?.textColor || 'rgba(255,255,255,0.82)',
    },
    login: {
      cardBackground: color(login.cardBackground, 'rgba(255,255,255,0.05)'),
      submitBg: color(login.submitBg, `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`),
      submitText: color(login.submitText, '#ffffff'),
      toggleText: color(login.toggleText, 'rgba(255,255,255,0.55)'),
      inputBg: color(inputs.bg, 'rgba(255,255,255,0.1)'),
      inputBorder: color(inputs.border, 'rgba(255,255,255,0.2)'),
      inputText: color(inputs.text, '#ffffff'),
      inputPlaceholder: color(inputs.placeholder, 'rgba(255,255,255,0.4)'),
      inputFocusedBg: color(inputs.focusedBg, 'rgba(255,255,255,0.15)'),
    },
  };
}
