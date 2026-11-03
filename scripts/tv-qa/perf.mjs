// node perf.mjs <port> <key> <code> <ms>  -> deltas de métricas del renderer
const [port, keyName, keyCode, ms = '5000'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Performance.enable');
const get = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map((m) => [m.name, m.value]));
const a = await get(); const t0 = Date.now();
for (const ty of [keyName === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: keyName, windowsVirtualKeyCode: +keyCode, nativeVirtualKeyCode: +keyCode, ...(keyName === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });
await new Promise((r) => setTimeout(r, +ms));
const b = await get();
const d = (k) => (b[k] - a[k]);
console.log(JSON.stringify({ wallS: (Date.now() - t0) / 1000, taskS: +d('TaskDuration').toFixed(2), scriptS: +d('ScriptDuration').toFixed(2), layoutS: +d('LayoutDuration').toFixed(2), styleS: +d('RecalcStyleDuration').toFixed(2), layouts: d('LayoutCount'), styles: d('RecalcStyleCount'), nodes: b.Nodes, jsHeapMB: Math.round(b.JSHeapUsedSize / 1048576) }));
ws.close(); process.exit(0);
