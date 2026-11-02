// Uso: node cdp.mjs <port> <steps.json|inline-json>
// steps: [{"eval":"expr"}, {"key":"ArrowDown","code":40,"n":1}, {"wait":500}, {"events":true}]
import fs from 'node:fs';
const [port, arg] = process.argv.slice(2);
const steps = JSON.parse(fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg);
const targets = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const events = [];
const idx = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Network.requestWillBeSent' && /index[.]php/.test(d.params.request.url)) idx.set(d.params.requestId, (d.params.request.postData || d.params.request.url).replace(/(token|key|password|sessionId|pass)[^&"]{0,3}[=:][^&" ,]+/gi, '$1=…').slice(0, 220));
  if (d.method === 'Network.loadingFinished' && idx.has(d.params.requestId)) { const rid = d.params.requestId; const req = idx.get(rid); send('Network.getResponseBody', { requestId: rid }).then(r => events.push('BODY req=' + req + ' => ' + (r.result?.base64Encoded && /m3u8/.test(req) ? Buffer.from(r.result.body, 'base64').toString('utf8') : String(r.result?.body)).replace(/(token|key|password|sessionId)"?\s*[:=]\s*"?[^",&]+/gi, '$1=…').slice(0, 1200))); }
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type))
    events.push(`console.${d.params.type}: ` + d.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300));
  if (d.method === 'Runtime.exceptionThrown') events.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300));
  if (d.method === 'Network.loadingFailed') events.push(`NETFAIL: ${d.params.errorText} ${d.params.canceled ? '(canceled)' : ''} ${d.params.requestId}`);
  if (d.method === 'Network.responseReceived' && /m3u8|[.]ts([?]|$)|[.]m4s|[.]key|mpegurl|license/i.test(d.params.response.url + d.params.response.mimeType)) events.push('STREAM ' + d.params.response.status + ' ' + d.params.response.url.replace(/[?].*/, '').slice(-90));
  if (d.method === 'Network.responseReceived' && d.params.response.status >= 400 && !/Imagenes/.test(d.params.response.url)) events.push(`HTTP ${d.params.response.status} ${d.params.response.url.slice(0, 200)}`);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const s of steps) {
  if (s.eval) {
    const r = await send('Runtime.evaluate', { expression: s.eval, returnByValue: true, awaitPromise: true });
    console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result));
  } else if (s.key) {
    const code = s.code; const n = s.n || 1;
    for (let i = 0; i < n; i++) {
      for (const type of [s.key === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp'])
        await send('Input.dispatchKeyEvent', { type, key: s.key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, ...(s.key === 'Enter' && type === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });
      await sleep(s.gap ?? 250);
    }
  } else if (s.wait) await sleep(s.wait);
  else if (s.cmd) { const r = await send(s.cmd, s.params || {}); console.log(s.cmd, JSON.stringify(r.result ?? r.error).slice(0, 200)); }
  else if (s.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(s.shot, Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot); }
  else if (s.events) { console.log('EVENTS:', JSON.stringify(events.splice(0), null, 1)); }
}
console.log('EVENTS_END:', JSON.stringify(events));
ws.close(); process.exit(0);
