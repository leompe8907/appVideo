// node kl.mjs <port> <keyName> <keyCode> [seconds=15] [navKey=ArrowRight] [navCode=39]
// Ligero (sin Tracing/Profiler): latencia tecla→pintado dentro de la página + huecos del hilo principal.
const [port, keyName, keyCode, secs = '15', navKey = 'ArrowRight', navCode = '39'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (name, code) => { for (const ty of [name === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: +code, nativeVirtualKeyCode: +code, ...(name === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) }); };
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await ev(`(()=>{window.__kl=window.__kl||{};const k=window.__kl;clearInterval(k.hb);k.keys=[];k.gaps=[];k.t0=performance.now();let last=performance.now();k.hb=setInterval(()=>{const n=performance.now();if(n-last>250)k.gaps.push([Math.round(last-k.t0),Math.round(n-last)]);last=n},50);
if(!k.bound){k.bound=1;addEventListener('keydown',e=>{const s=performance.now();const rec={k:e.key,at:Math.round(s-k.t0)};k.keys.push(rec);requestAnimationFrame(()=>requestAnimationFrame(()=>{rec.paint=Math.round(performance.now()-s)}))},true)}return 1})()`);
await key(keyName, keyCode);
const t1 = Date.now();
while (Date.now() - t1 < +secs * 1000) { await sleep(1000); await key(navKey, navCode); }
await sleep(3000);
const out = JSON.parse(await ev(`(()=>{clearInterval(window.__kl.hb);return JSON.stringify({keys:window.__kl.keys,gaps:window.__kl.gaps})})()`));
console.log('keys (tecla@ms tras inicio → pintado ms):', out.keys.map((k) => `${k.k}@${k.at}→${k.paint ?? '?'}`).join(' '));
console.log('huecos del hilo >250ms [inicio,ms]:', JSON.stringify(out.gaps));
const total = out.gaps.reduce((s, g) => s + g[1], 0);
console.log('hilo bloqueado total ms:', total, 'max hueco:', Math.max(0, ...out.gaps.map((g) => g[1])));
ws.close(); process.exit(0);
