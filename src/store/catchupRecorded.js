// Lógica pura de catchup (normalización de listas, fechas y el cálculo de
// `recorded` a partir de tareas de grabación + grupos/eventos de catchup ya
// cargados). Separada de `preloadStore.js` para poder testearla sin instanciar
// el store de Zustand ni mockear `panaccessService`.

export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var ms = new Date(v).getTime();
  return isFinite(ms) ? ms : null;
}

export function normalizeList(resp, keys) {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object') {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var value = resp[k];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

/**
 * Cruza las tareas de grabación (`tasksList`, respuesta cruda de
 * `panaccessService.getRecordingTasks`) con los grupos de catchup ya cargados
 * (`groupsWithEvents`, cada uno con `.events`) para armar la lista `recorded`.
 *
 * Antes de esta versión, por cada tarea se recorrían TODOS los grupos y sus
 * eventos buscando el `catchupId` (O(T×G×E)), y al encontrarlo se volvía a
 * recorrer el mismo grupo desde cero para "reencontrar" el evento ya hallado
 * (un segundo recorrido 100% redundante). Acá se construye un índice
 * `catchupId -> {group, event}` una sola vez en O(G×E) y cada tarea hace una
 * búsqueda O(1) en ese índice — el total pasa a ser O(G×E + T).
 *
 * Se preserva el criterio "el primer grupo/evento en orden de iteración gana"
 * del código anterior: si dos grupos distintos tuvieran (por datos
 * inconsistentes del middleware) un evento con el mismo id, gana el primero
 * que aparece en `groupsWithEvents`.
 */
export function prepareRecorded(tasksList, groupsWithEvents) {
  var validTasks = normalizeList(tasksList, ['recordingTasks', 'items', 'tasks', 'answer']).filter(function (t) {
    var mode = Number(t.mode || 0);
    var catchupId = Number(t.catchupId != null ? t.catchupId : (t.catchup_id != null ? t.catchup_id : (t.id != null ? t.id : 0)));
    var deleted = !!t.deleted;
    return mode === 4 && catchupId > 0 && !deleted;
  });

  var eventIndex = new Map();
  for (var gi = 0; gi < groupsWithEvents.length; gi++) {
    var g = groupsWithEvents[gi];
    if (!Array.isArray(g.events)) continue;
    for (var ei = 0; ei < g.events.length; ei++) {
      var ev = g.events[ei];
      var evId = String(ev && ev.id != null ? ev.id : (ev && ev.eventId != null ? ev.eventId : (ev && ev.catchupId != null ? ev.catchupId : '')));
      if (!evId || eventIndex.has(evId)) continue;
      eventIndex.set(evId, { group: g, event: ev });
    }
  }

  var recorded = validTasks
    .map(function (task) {
      var taskCatchupId = task.catchupId != null ? task.catchupId : (task.catchup_id != null ? task.catchup_id : (task.id != null ? task.id : null));
      if (taskCatchupId == null) return null;

      var taskCatchupIdStr = String(taskCatchupId);
      var match = eventIndex.get(taskCatchupIdStr);
      if (!match) return null;

      var group = match.group;
      var event = match.event;

      var startMs = toMs(task.startDate != null ? task.startDate : (task.start != null ? task.start : null));

      var rec = {};
      Object.keys(task).forEach(function (k) { rec[k] = task[k]; });
      rec.catchupId = Number(taskCatchupIdStr);
      rec.startDate = startMs != null ? new Date(startMs) : null;
      rec.event = event;
      rec.image = group.img != null ? group.img : (group.imageUrl != null ? group.imageUrl : (group.posterUrl != null ? group.posterUrl : null));
      rec.lcn = group.lcn != null ? group.lcn : null;
      rec.catchupName = group.name != null ? group.name : null;
      return rec;
    })
    .filter(Boolean);

  recorded.sort(function (a, b) {
    var aa = a.startDate ? a.startDate.valueOf() : 0;
    var bb = b.startDate ? b.startDate.valueOf() : 0;
    return aa - bb;
  });

  return recorded;
}
