// node nav.mjs <port> <label> <key:code:n,...>   mide tecla -> foco / anillo / pintado
const [port, label, spec] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await new Promise((r) => (ws.onopen = r));
await ev(`(()=>{if(window.__nv&&window.__nv.on)return 0;const nv=window.__nv={on:1,rows:[],cur:null};addEventListener('keydown',e=>{nv.cur={k:e.key,t0:performance.now(),f:null,r:null,p:null,from:(document.activeElement.className||'').toString().slice(0,24)};nv.rows.push(nv.cur);requestAnimationFrame(()=>requestAnimationFrame(()=>{const c=nv.cur;if(c&&c.p==null)c.p=performance.now()-c.t0}))},true);document.addEventListener('focusin',()=>{const c=nv.cur;if(c&&c.f==null)c.f=performance.now()-c.t0},true);const ring=document.querySelector('.tv-focus-ring');if(ring)new MutationObserver(()=>{const c=nv.cur;if(c&&c.r==null)c.r=performance.now()-c.t0}).observe(ring,{attributes:true,attributeFilter:['style','class']});return 1})()`);
await ev('window.__nv.rows.length=0;1');
for (const part of spec.split(',')) {
  const [name, code, n] = part.split(':');
  for (let i = 0; i < +n; i++) {
    for (const ty of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: +code, nativeVirtualKeyCode: +code });
    await sleep(+(process.env.GAP||1100));
  }
}
const rows = JSON.parse(await ev('JSON.stringify(__nv.rows)'));
const stat = (k) => { const a = rows.map((r) => r[k]).filter((x) => x != null).sort((x, y) => x - y); if (!a.length) return 'n/a'; const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))]; return `med ${q(0.5).toFixed(0)}ms p90 ${q(0.9).toFixed(0)}ms max ${a[a.length - 1].toFixed(0)}ms (n=${a.length}/${rows.length})`; };
console.log(`== ${label}\n foco:    ${stat('f')}\n anillo:  ${stat('r')}\n pintado: ${stat('p')}`);
console.log(' detalle:', rows.map((r) => `${r.k.replace('Arrow', '')}:${r.f == null ? '-' : r.f.toFixed(0)}/${r.p == null ? '-' : r.p.toFixed(0)}`).join(' '));
ws.close(); process.exit(0);
