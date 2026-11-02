// node bench.mjs <port> <label>   (la app debe estar en /home/inicio con un canal enfocado)
const [port, label = 'run'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map(); let masters = 0; let counting = false;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  if (d.method === 'Network.requestWillBeSent' && counting) { const u = d.params.request.url; if (/requestMode=m3u8/.test(u) && !/substream|file=/.test(u)) masters += 1; }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (name, code) => { for (const ty of [name === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) }); };
await new Promise((r) => (ws.onopen = r));
await send('Network.enable'); await send('Runtime.enable');
await ev(`(()=>{if(window.__bn)return 0;const b=window.__bn={armed:false,t0:null,play:null,waits:0};addEventListener('keydown',()=>{if(b.armed&&b.t0==null)b.t0=performance.now()},true);['playing','waiting'].forEach(n=>document.addEventListener(n,e=>{if(e.target.tagName!=='VIDEO'||b.t0==null)return;if(n==='playing'&&b.play==null)b.play=performance.now();if(n==='waiting'&&b.play!=null)b.waits++},true));return 1})()`);
async function measure(name, code, extraMs = 12000) {
  await ev('Object.assign(window.__bn,{armed:true,t0:null,play:null,waits:0});1'); masters = 0; counting = true;
  await key(name, code);
  let ttff = null; const t0 = Date.now();
  while (Date.now() - t0 < 40000) { const r = await ev('__bn.play==null||__bn.t0==null?null:Math.round(__bn.play-__bn.t0)'); if (r != null) { ttff = r; break; } await sleep(250); }
  await sleep(extraMs); counting = false;
  const info = await ev(`(()=>{const v=document.querySelector('video');return v?v.videoWidth+'x'+v.videoHeight+' buf='+(v.buffered.length?(v.buffered.end(v.buffered.length-1)-v.currentTime).toFixed(0):0):'-'})()`);
  const waits = await ev('__bn.waits');
  return { ttff, masters, waits, info };
}
const out = [];
for (let i = 1; i <= (process.env.OPENS ?? 3); i++) {
  // Escape = BACK: solo si hay player abierto (en Inicio, BACK sale de la app).
  if (await ev("!!document.querySelector('.player-hud')")) { await key('Escape', 27); await sleep(4000); }
  const r = await measure('Enter', 13); out.push({ kind: 'open', n: i, ...r }); console.log(label, 'open', i, JSON.stringify(r));
}
for (let i = 1; i <= (process.env.ZAPS ?? 4); i++) {
  const r = await measure('PageUp', 33); out.push({ kind: 'zap', n: i, ...r }); console.log(label, 'zap', i, JSON.stringify(r));
}
const avg = (k) => { const a = out.filter((o) => o.kind === k && o.ttff != null).map((o) => o.ttff); return a.length ? (a.reduce((x, y) => x + y, 0) / a.length / 1000).toFixed(2) + 's (n=' + a.length + ')' : 'n/a'; };
console.log(`SUMMARY ${label}: open avg ${avg('open')} | zap avg ${avg('zap')} | stalls(open+zap) ${out.reduce((s, o) => s + (o.waits || 0), 0)}`);
ws.close(); process.exit(0);
