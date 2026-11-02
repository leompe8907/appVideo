// node sweep.mjs <port>  -> recorre las secciones por D-pad y mide carga y trabajo del hilo principal
const [port] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyDown = async (name, code) => { const t0 = Date.now(); for (const ty of [name === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) }); return Date.now() - t0; };
const press = async (n, c) => { await keyDown(n, c); await sleep(350); };
await new Promise((r) => (ws.onopen = r));
await send('Performance.enable');
const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((m) => [m.name, m.value]));
const only = process.argv[3]; const targets0 = [
  ['/home/inicio', '.channel-card', 'Inicio'],
  ['/home/epg', '.epg-card', 'Guia de canales'],
  ['/home/catchup', '.catchup-card', 'Catchup'],
  ['/home/buscador', '.search-input', 'Buscador'],
  ['/home/mi-cuenta', '.mi-cuenta-item', 'Mi cuenta'],
  ['/home/inicio', '.channel-card', 'Inicio (vuelta)'],
];
const targets = only ? targets0.filter((x) => x[0] === only) : targets0;
for (const [href, sel, name] of targets) {
  for (let i = 0; i < 14 && !(await ev(`!!document.activeElement.closest('.home-sidebar')`)); i++) await press('ArrowLeft', 37);
  const order = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('a.home-sidebar-link')].map(a=>a.getAttribute('href')))`));
  const cur = await ev(`document.activeElement.getAttribute('href')||''`);
  const steps = order.indexOf(href) - order.indexOf(cur);
  for (let i = 0; i < Math.abs(steps); i++) await press(steps > 0 ? 'ArrowDown' : 'ArrowUp', steps > 0 ? 40 : 38);
  const errs0 = await ev('window.__errs.length'); const a = await metrics(); const t0 = Date.now();
  const blocked = await keyDown('Enter', 13);
  let toPath = null; let toReady = null;
  while (Date.now() - t0 < +(process.env.LIMIT || 25000)) {
    const [p, n] = JSON.parse(await ev(`JSON.stringify([location.pathname,document.querySelectorAll('${sel}').length])`));
    if (toPath == null && p === href) toPath = Date.now() - t0;
    if (p === href && n > 0) { toReady = Date.now() - t0; break; }
    await sleep(200);
  }
  const preload = (await ev('location.pathname')) === '/preload';
  await sleep(Math.max(0, +(process.env.WIN || 6000) - (Date.now() - t0)));
  const b = await metrics();
  const cards = await ev(`document.querySelectorAll('${sel}').length`);
  console.log(`${name.padEnd(16)} ruta:${toPath ?? '-'}ms  listo:${toReady ?? 'NO'}ms  bloqueo-tecla:${blocked}ms  hilo-ocupado(6s):${(b.TaskDuration - a.TaskDuration).toFixed(1)}s  script:${(b.ScriptDuration - a.ScriptDuration).toFixed(1)}s  elementos:${cards}  nodos:${b.Nodes}  errores-nuevos:${(await ev('window.__errs.length')) - errs0}${preload ? '  (REDIRIGIO A /PRELOAD)' : ''}`);
  if (preload) { while ((await ev('location.pathname')) === '/preload') await sleep(1500); await sleep(2500); }
}
ws.close(); process.exit(0);
