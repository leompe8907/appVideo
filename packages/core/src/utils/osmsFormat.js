export function previewText(message, maxLen = 120) {
  const txt = typeof message === 'string' ? message.trim() : String(message ?? '');
  if (!txt) return '';
  return txt.length > maxLen ? `${txt.slice(0, maxLen)}…` : txt;
}

export function formatFullDate(date, locale) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleString(locale || undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatCardDate(date, locale) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);

    if (diffDays === 0) {
      return d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(locale || undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function getOsmDayGroup(date, t) {
  if (!date) return t('osms.groupEarlier', { defaultValue: 'Anteriores' });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfMsg) / 86400000);

  if (diffDays === 0) return t('osms.groupToday', { defaultValue: 'Hoy' });
  if (diffDays === 1) return t('osms.groupYesterday', { defaultValue: 'Ayer' });
  return t('osms.groupEarlier', { defaultValue: 'Anteriores' });
}

/**
 * Agrupa mensajes OSMS por etiqueta de día (Hoy / Ayer / Anteriores).
 * @param {Array} items
 * @param {Function} t - i18n translate
 * @returns {Array<{ label: string, items: Array }>}
 */
export function groupOsmsByDay(items, t) {
  const list = Array.isArray(items) ? items : [];
  const groups = [];
  let currentLabel = null;
  let currentItems = [];

  list.forEach((item) => {
    const label = getOsmDayGroup(item?.time, t);
    if (label !== currentLabel) {
      if (currentItems.length > 0) {
        groups.push({ label: currentLabel, items: currentItems });
      }
      currentLabel = label;
      currentItems = [item];
      return;
    }
    currentItems.push(item);
  });

  if (currentItems.length > 0) {
    groups.push({ label: currentLabel, items: currentItems });
  }

  return groups;
}

export function captureInitialUnreadIds(items, hasNew, unreadCount) {
  if (!hasNew || unreadCount <= 0 || !Array.isArray(items)) return new Set();
  return new Set(items.slice(0, unreadCount).map((m) => String(m.id)));
}
