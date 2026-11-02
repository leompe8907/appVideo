// node ep.mjs <port> <seconds>: durante el preload, cuenta pedidos de EPG y su duracion
const [port, secs = '25'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const req = new Map(); const done = []; let inflightMax = 0; let inflight = 0; const samples = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  const p = d.params;
  if (d.method === 'Network.requestWillBeSent' && /[?&]d=epg/.test(p.request.url)) { req.set(p.requestId, p.timestamp); inflight++; inflightMax = Math.max(inflightMax, inflight); }
  if ((d.method === 'Network.loadingFinished' || d.method === 'Network.loadingFailed') && req.has(p.requestId)) { done.push(p.timestamp - req.get(p.requestId)); req.delete(p.requestId); inflight--; } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Network.enable'); await send('Performance.enable');
const get = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((x) => [x.name, x.value]));
const a = await get();
for (let i = 0; i < +secs; i++) { await new Promise((r) => setTimeout(r, 1000)); samples.push(inflight); }
const b = await get();
const avg = done.length ? done.reduce((x, y) => x + y, 0) / done.length : 0;
console.log(`ventana ${secs}s: pedidos EPG terminados=${done.length}  duracion media=${(avg * 1000).toFixed(0)}ms  maximo en vuelo=${inflightMax}  en vuelo promedio=${(samples.reduce((x, y) => x + y, 0) / samples.length).toFixed(1)}  hilo ocupado=${(b.TaskDuration - a.TaskDuration).toFixed(1)}s de ${secs}s`);
ws.close(); process.exit(0);
