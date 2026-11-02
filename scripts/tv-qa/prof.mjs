// node prof.mjs <port> <keyName> <keyCode> <ms>
import fs from 'node:fs';
const [port, keyName, keyCode, ms = '6000'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Profiler.enable'); await send('Profiler.setSamplingInterval', { interval: 1000 }); await send('Profiler.start');
const type = keyName === 'Enter' ? 'keyDown' : 'rawKeyDown';
for (const ty of [type, 'keyUp']) await send('Input.dispatchKeyEvent', { type: ty, key: keyName, windowsVirtualKeyCode: +keyCode, nativeVirtualKeyCode: +keyCode, ...(keyName === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });
await new Promise((r) => setTimeout(r, +ms));
const { result } = await send('Profiler.stop');
const prof = result.profile; fs.writeFileSync('profile.json', JSON.stringify(prof));
const nodes = new Map(prof.nodes.map((n) => [n.id, n])); const self = new Map();
const dt = prof.timeDeltas; prof.samples.forEach((s, i) => self.set(s, (self.get(s) || 0) + (dt[i] || 0)));
const parent = new Map(); prof.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const incl = new Map(); for (const [nid, us] of self) { let c = nid; while (c) { incl.set(c, (incl.get(c) || 0) + us); c = parent.get(c); } }
const label = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().slice(0, 40)}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`;
const total = prof.samples.reduce((a, s, i) => a + (dt[i] || 0), 0) / 1000;
console.log('total sampled ms', Math.round(total));
const bySelf = new Map(); for (const [nid, us] of self) { const l = label(nodes.get(nid)); bySelf.set(l, (bySelf.get(l) || 0) + us); }
console.log('--- top self ms'); [...bySelf].sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([l, us]) => console.log(String(Math.round(us / 1000)).padStart(6), l));
const byIncl = new Map(); for (const [nid, us] of incl) { const l = label(nodes.get(nid)); byIncl.set(l, Math.max(byIncl.get(l) || 0, us)); }
console.log('--- top inclusive ms'); [...byIncl].filter(([l]) => !/\(root\)|\(program\)|\(idle\)/.test(l)).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([l, us]) => console.log(String(Math.round(us / 1000)).padStart(6), l));
ws.close(); process.exit(0);
