// node trace.mjs <port> <keyName> <keyCode> [waitMs] [pre-steps-json]
const [port, keyName, keyCode, waitMs = '25000'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const rows = []; const req = new Map(); let off = null;
const short = (u) => { try { const x = new URL(u); const q = x.searchParams; return (x.host.split('.')[0] + x.pathname + ' ' + ['requestMode', 'f', 'streamId', 'substream', 'chunk', 'file', 'catchupId'].filter((k) => q.has(k)).map((k) => k + '=' + q.get(k)).join('&')).slice(0, 110); } catch { return u.slice(0, 80); } };
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  const p = d.params;
  if (d.method === 'Network.requestWillBeSent') { if (off === null) off = p.wallTime * 1000 - p.timestamp * 1000; if (/\.(png|jpe?g|webp|svg|css|woff2?)(\?|$)/i.test(p.request.url) || /Imagenes|favicon/.test(p.request.url)) return; req.set(p.requestId, { u: short(p.request.url), s: p.wallTime * 1000 }); rows.push({ t: p.wallTime * 1000, m: 'REQ  ' + short(p.request.url), id: p.requestId }); }
  if (d.method === 'Network.responseReceived' && req.has(p.requestId)) rows.push({ t: off + p.timestamp * 1000, m: 'HDR  ' + req.get(p.requestId).u });
  if (d.method === 'Network.loadingFinished' && req.has(p.requestId)) rows.push({ t: off + p.timestamp * 1000, m: 'DONE ' + req.get(p.requestId).u + ' ' + Math.round(p.encodedDataLength / 1024) + 'KB' });
  if (d.method === 'Runtime.consoleAPICalled' && /^(MEDIA|KEY):/.test(String(p.args[0]?.value))) rows.push({ t: p.timestamp, m: '*** ' + p.args[0].value });
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable'); await send('Network.enable');
await send('Runtime.evaluate', { expression: `(()=>{if(window.__tr)return 0;window.__tr=1;['loadstart','loadedmetadata','loadeddata','canplay','playing','waiting','stalled'].forEach(t=>document.addEventListener(t,e=>{if(e.target.tagName==='VIDEO')console.debug('MEDIA:'+t+' ct='+e.target.currentTime.toFixed(1)+' '+e.target.videoWidth+'x'+e.target.videoHeight)},true));addEventListener('keydown',e=>console.debug('KEY:'+e.key+'/'+e.keyCode),true);return 1})()` });
const type = keyName === 'Enter' ? 'keyDown' : 'rawKeyDown';
for (const ty of [type, 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: keyName, windowsVirtualKeyCode: +keyCode, nativeVirtualKeyCode: +keyCode, ...(keyName === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });
await new Promise((r) => setTimeout(r, +waitMs));
const k = rows.find((r) => r.m.startsWith('*** KEY'))?.t ?? rows[0]?.t;
rows.sort((a, b) => a.t - b.t);
for (const r of rows) console.log(((r.t - k) / 1000).toFixed(2).padStart(6) + 's  ' + r.m);
ws.close(); process.exit(0);
