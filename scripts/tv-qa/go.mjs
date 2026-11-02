// node go.mjs <port> <href> [watchMs]  -> navega por D-pad a un link del sidebar y vigila el estado de carga
const [port, href, watchMs = '9000'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (name, code) => { for (const ty of [name === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(name === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) }); await sleep(350); };
await new Promise((r) => (ws.onopen = r));
const act = () => ev(`(document.activeElement.getAttribute('href')||'')`);
for (let i = 0; i < 14 && !(await ev(`!!document.activeElement.closest('.home-sidebar')`)); i++) await key('ArrowLeft', 37);
const order = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('a.home-sidebar-link')].map(a=>a.getAttribute('href')))`));
let cur = await act(); const steps = order.indexOf(href) - order.indexOf(cur);
for (let i = 0; i < Math.abs(steps); i++) await key(steps > 0 ? 'ArrowDown' : 'ArrowUp', steps > 0 ? 40 : 38);
console.log('sidebar en', await act(), 'objetivo', href);
if (!process.env.NOENTER) await ev(`(()=>{window.__cu=[];const t0=performance.now();window.__ci=setInterval(()=>{window.__cu.push(Math.round(performance.now()-t0)+'ms '+location.pathname+' cards='+document.querySelectorAll('.catchup-card').length)},250);return 1})()`);
if (process.env.NOENTER) { console.log('listo sin Enter'); ws.close(); process.exit(0); }
await key('Enter', 13); await sleep(+watchMs);
console.log(await ev(`clearInterval(window.__ci);window.__cu.filter((l,i,a)=>i===0||l.split(' ').slice(1).join(' ')!==a[i-1].split(' ').slice(1).join(' ')).join(String.fromCharCode(10))`));
ws.close(); process.exit(0);
