import {
  DEFAULT_PLAYER_HUD_LAYOUT,
  VALID_PLAYER_HUD_BUTTON_KEYS,
} from '../config/playerHudLayout.js';

/** Tipos de reproducción en `hudLayout.overrides`. */
export const PLAYER_HUD_PLAYBACK_TYPES = Object.freeze(['service', 'vod', 'catchup']);

/** Plataformas en claves compuestas (`tv:service`, `pc:vod`). */
export const PLAYER_HUD_PLATFORMS = Object.freeze(['tv', 'pc']);

function filterValidKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.filter((k) => typeof k === 'string' && VALID_PLAYER_HUD_BUTTON_KEYS.has(k));
}

function resolveZone(brandKeys, defaultKeys) {
  const filtered = filterValidKeys(brandKeys);
  if (filtered.length > 0) return filtered;
  return [...defaultKeys];
}

function mergeZone(patchKeys, baseKeys) {
  if (Array.isArray(patchKeys)) return filterValidKeys(patchKeys);
  return baseKeys;
}

/** Layout base (zonas + default), sin aplicar overrides por tipo. */
function resolveBaseZones(brandHudLayout) {
  const src = brandHudLayout || {};
  const def = DEFAULT_PLAYER_HUD_LAYOUT;
  return {
    top: {
      left: resolveZone(src.top?.left, def.top.left),
      center: resolveZone(src.top?.center, def.top.center),
      right: resolveZone(src.top?.right, def.top.right),
    },
    bottom: resolveZone(src.bottom, def.bottom),
  };
}

function mergeLayoutPatch(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  return {
    top: {
      left: mergeZone(patch.top?.left, base.top.left),
      center: mergeZone(patch.top?.center, base.top.center),
      right: mergeZone(patch.top?.right, base.top.right),
    },
    bottom: mergeZone(patch.bottom, base.bottom),
  };
}

/**
 * Aplica overrides en capas: tipo → plataforma+tipo → plataforma.
 * Ej.: `service` + `tv:service` en TV/live fusionan zonas.
 */
function applyHudOverrides(base, overrides, context = {}) {
  if (!overrides || typeof overrides !== 'object') return base;
  const { playbackType, isTV } = context;
  if (!playbackType || !PLAYER_HUD_PLAYBACK_TYPES.includes(playbackType)) return base;

  const platform = isTV ? 'tv' : 'pc';
  const layers = [
    overrides[playbackType],
    overrides[`${platform}:${playbackType}`],
    overrides[platform],
  ];

  let layout = base;
  for (const patch of layers) {
    if (patch && typeof patch === 'object') {
      layout = mergeLayoutPatch(layout, patch);
    }
  }
  return layout;
}

function cloneLayoutPatch(patch) {
  if (!patch || typeof patch !== 'object') return {};
  const out = {};
  if (patch.top && typeof patch.top === 'object') {
    out.top = {};
    if (Array.isArray(patch.top.left)) out.top.left = [...patch.top.left];
    if (Array.isArray(patch.top.center)) out.top.center = [...patch.top.center];
    if (Array.isArray(patch.top.right)) out.top.right = [...patch.top.right];
  }
  if (Array.isArray(patch.bottom)) out.bottom = [...patch.bottom];
  return out;
}

/**
 * Combina `player.hudLayout` de la marca con el default y, si hay contexto,
 * aplica `hudLayout.overrides` por tipo (`service` | `vod` | `catchup`) o `pc:` / `tv:`.
 *
 * @param {object} [brandHudLayout]
 * @param {{ playbackType?: string, isTV?: boolean }} [context]
 */
export function resolvePlayerHudLayout(brandHudLayout, context = {}) {
  const base = resolveBaseZones(brandHudLayout);
  return applyHudOverrides(base, brandHudLayout?.overrides, context);
}

/**
 * Copia independiente del layout (cada marca puede personalizar sin compartir referencia).
 * @param {object} [brandHudLayout]
 */
export function clonePlayerHudLayout(brandHudLayout) {
  const src = brandHudLayout && typeof brandHudLayout === 'object' ? brandHudLayout : {};
  const resolved = resolveBaseZones(src);
  const cloned = {
    top: {
      left: [...resolved.top.left],
      center: [...resolved.top.center],
      right: [...resolved.top.right],
    },
    bottom: [...resolved.bottom],
  };

  if (src.overrides && typeof src.overrides === 'object') {
    cloned.overrides = {};
    for (const [key, patch] of Object.entries(src.overrides)) {
      cloned.overrides[key] = cloneLayoutPatch(patch);
    }
  }

  return cloned;
}
