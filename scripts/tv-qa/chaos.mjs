// node chaos.mjs <puerto> <escenario[,escenario…]|all>
// Pruebas de "casos raros" en el TV por CDP: ráfagas de teclas, Atrás repetido, zapping, abrir/cerrar el
// player, red caída, recarga a mitad de reproducción. Tras cada escenario informa ruta, foco, errores JS
// nuevos, nodos/heap y si la app sigue respondiendo a una tecla. La app debe estar en /home/inicio.
const [port, which = 'all'] = process.argv.slice(2);
const t = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(t[0].webSocketDebuggerUrl);
let id = 0; const pend = new Map();
let fetchMode = null;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  if (d.method === 'Fetch.requestPaused') {
    const requestId = d.params.requestId;
    if (fetchMode === 'html') send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }], body: Buffer.from('<!doctype html><html></html>').toString('base64') });
    else if (fetchMode === 'fail') send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' });
    else send('Fetch.continueRequest', { requestId });
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { Enter: 13, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, PageUp: 33, PageDown: 34 };
const key = async (name, opts = {}) => {
  const code = KEYS[name];
  for (const ty of [name === 'Enter' ? 'keyDown' : 'rawKeyDown', 'keyUp']) {
    if (ty === 'keyUp' && opts.hold) continue;
    await send('Input.dispatchKeyEvent', { type: ty, key: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, autoRepeat: !!opts.repeat, ...(name === 'Enter' && ty === 'keyDown' ? { text: String.fromCharCode(13) } : {}) });
  }
};
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable'); await send('Network.enable');

const inject = () => ev(`(()=>{if(window.__chaos)return 0;const c=window.__chaos={errs:[],gaps:[],t0:performance.now()};
addEventListener('error',e=>c.errs.push('error: '+(e.message||'')+' '+(e.filename||'').split('/').pop()+':'+e.lineno));
addEventListener('unhandledrejection',e=>c.errs.push('rejection: '+String(e.reason&&(e.reason.stack||e.reason.message||e.reason)).slice(0,220)));
const oe=console.error;console.error=function(){try{const m=[].map.call(arguments,a=>String(a&&a.message||a)).join(' ').slice(0,200);if(!/VIDEOJS|MEDIA_ERR|404|tv-platform/.test(m))c.errs.push('console.error: '+m)}catch(_){}return oe.apply(console,arguments)};
let last=performance.now();setInterval(()=>{const n=performance.now();if(n-last>400)c.gaps.push(Math.round(n-last));last=n},50);return 1})()`);
await inject();

const q = (s) => ev(`document.querySelector(${JSON.stringify(s)})?1:0`);
const state = () => ev(`(()=>{const a=document.activeElement,c=window.__chaos;const r=JSON.stringify({path:location.pathname,hud:!!document.querySelector('.player-hud'),active:(a&&a!==document.body)?((a.id||'')+'.'+String(a.className||'').split(' ')[0]).slice(0,40):'(body)',focusOk:!!a&&a!==document.body&&document.body.contains(a),sidebar:!!(a&&a.closest&&a.closest('.home-sidebar')),nodes:document.getElementsByTagName('*').length,heapMB:Math.round(performance.memory.usedJSHeapSize/1048576),errs:c.errs.length,maxGapMs:Math.max(0,...c.gaps)});c.gaps.length=0;return r})()`).then(JSON.parse);
const newErrs = async (from) => (await ev(`JSON.stringify(window.__chaos.errs.slice(${from}))`)).length > 2 ? JSON.parse(await ev(`JSON.stringify(window.__chaos.errs.slice(${from}))`)) : [];
async function alive() {
  // Una flecha debe poder mover el foco o al menos no bloquear: se mide la latencia tecla→pintado.
  const ms = await ev(`new Promise(r=>{const s=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-s))))})`);
  return ms;
}
async function waitFor(fn, ms = 30000, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await sleep(step); } return false; }
async function ensureHome() {
  if (await q('.player-hud')) { await key('Escape'); await sleep(2500); }
  if (!(await ev(`location.pathname==='/home/inicio'`))) await ev(`location.href=location.origin+'/home/inicio?brand=cableatlantico';1`);
  await waitFor(() => ev(`document.querySelectorAll('.channel-card').length>10`), 90000, 1000);
  await sleep(3000);
  await inject();
}
async function focusCard(n = 60) { await ev(`(()=>{const c=[...document.querySelectorAll('.channel-card')];const e=c[Math.min(${n},c.length-1)];if(e){e.focus();e.scrollIntoView({block:'center',inline:'center'})}return 1})()`); await sleep(800); }
const ARROWS = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

const SC = {
  async mash() { // 80 flechas aleatorias a 30 ms
    await focusCard(30); for (let i = 0; i < 80; i++) { await key(rnd(ARROWS)); await sleep(30); }
    await sleep(2000); return { latencyMs: await alive() };
  },
  async mashHold() { // tecla mantenida (autoRepeat) en cada dirección
    await focusCard(30);
    for (const k of ARROWS) { for (let i = 0; i < 25; i++) { await key(k, { repeat: true, hold: true }); await sleep(40); } await key(k); await sleep(500); }
    return { latencyMs: await alive() };
  },
  async backSpamSection() { // Atrás repetido en una sección: nunca debe salir de la app ni romper el foco
    await focusCard(30); for (let i = 0; i < 3; i++) { await key('ArrowLeft'); await sleep(200); }
    const hrefs = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('a.home-sidebar-link')].map(a=>a.getAttribute('href')))`));
    const idx = hrefs.indexOf('/home/catchup'); const cur = await ev(`document.activeElement.getAttribute('href')||''`);
    const steps = idx - hrefs.indexOf(cur); for (let i = 0; i < Math.abs(steps); i++) { await key(steps > 0 ? 'ArrowDown' : 'ArrowUp'); await sleep(250); }
    await key('Enter'); await waitFor(() => ev(`document.querySelectorAll('.catchup-card').length>5`), 30000, 500);
    await key('ArrowRight'); await sleep(300);
    for (let i = 0; i < 3; i++) { await key("Escape"); await sleep(120); }
    await sleep(1500); return { latencyMs: await alive() };
  },
  async sidebarHop() { // saltar entre secciones sin esperar a que carguen
    await focusCard(30); for (let i = 0; i < 4; i++) { await key('ArrowLeft'); await sleep(150); }
    for (let i = 0; i < 24; i++) { await key(i % 7 < 4 ? 'ArrowDown' : 'ArrowUp'); await sleep(60); if (i % 3 === 0) await key('Enter'); await sleep(250); }
    await sleep(6000); return { latencyMs: await alive() };
  },
  async openCloseLoop() { // abrir y cerrar el player 6 veces seguidas
    const out = [];
    for (let i = 0; i < 6; i++) {
      await ensureHome(); await focusCard(40 + i); await key('Enter');
      await waitFor(() => q('.player-hud'), 8000, 200); await sleep(1500 + i * 700);
      await key('Escape'); await sleep(1500);
      out.push(await ev(`document.querySelector('.player-hud')?'HUD-STUCK':'ok'`));
    }
    return { cycles: out.join(',') };
  },
  async doubleEnter() { // Enter doble y Atrás inmediato mientras carga
    await ensureHome(); await focusCard(50); await key('Enter'); await sleep(80); await key('Enter'); await sleep(80); await key('Enter'); await sleep(1500);
    await key('Escape'); await sleep(400); await key('Escape'); await sleep(2500);
    return { hudOpen: await q('.player-hud'), latencyMs: await alive() };
  },
  async zapSpam() { // PageUp/PageDown rápidos y luego esperar a que reproduzca
    await ensureHome(); await focusCard(60); await key('Enter'); await waitFor(() => q('.player-hud'), 8000, 200); await sleep(4000);
    for (let i = 0; i < 16; i++) { await key(i % 5 === 4 ? 'PageDown' : 'PageUp'); await sleep(i < 8 ? 120 : 400); }
    const ok = await waitFor(() => ev(`(()=>{const v=document.querySelector('video');return !!v&&!v.paused&&v.readyState>=3&&v.currentTime>0})()`), 45000, 1000);
    const lcn = await ev(`(document.querySelector('.player-hud__channel-lcn')||{}).textContent||''`);
    return { playingAfterSpam: ok, lcn, hudStillOpen: await q('.player-hud') };
  },
  async hudKeys() { // teclas del HUD en cualquier orden: Arriba/Abajo/Izq/Der/Enter con el player abierto
    if (!(await q('.player-hud'))) { await ensureHome(); await focusCard(60); await key('Enter'); await waitFor(() => q('.player-hud'), 8000, 200); await sleep(3000); }
    for (let i = 0; i < 40; i++) { await key(rnd([...ARROWS, 'ArrowUp'])); await sleep(70); }
    await key('Escape'); await sleep(600); const hud = await q('.player-hud'); if (hud) { await key('Escape'); await sleep(1500); }
    return { closedWithTwoBacks: !(await q('.player-hud')), latencyMs: await alive() };
  },
  async offlineDuringPlay() { // red caída 12 s a mitad de reproducción y recuperación
    await ensureHome(); await focusCard(60); await key('Enter'); await waitFor(() => q('.player-hud'), 8000, 200); await sleep(15000);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await sleep(+(process.env.OFF_MS || 12000));
    await send('Page.captureScreenshot', { format: 'png' }).then((r) => import('node:fs').then((fs) => fs.writeFileSync('offline-end.png', Buffer.from(r.result.data, 'base64'))));
    const during = await ev(`JSON.stringify({err:(document.querySelector('.player-hud__error')||{}).textContent||'',spinner:!!document.querySelector('.player-hud__spinner,.player-hud__loading')})`);
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const rec = await waitFor(() => ev(`(()=>{const v=document.querySelector('video');return !!v&&!v.paused&&v.readyState>=3})()`), 60000, 1000);
    return { during, recoveredAfterOnline: rec, errorStillShown: !!(await ev(`(document.querySelector('.player-hud__error')||{}).textContent||''`)) };
  },
  async offlineSection() { // sección sin red y reintento
    if (await q('.player-hud')) { await key('Escape'); await sleep(2000); }
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await ev(`history.pushState({},'','/home/vod');dispatchEvent(new PopStateEvent('popstate'));1`); await sleep(8000);
    const off = await ev(`JSON.stringify({path:location.pathname,body:(document.querySelector('.home-shell-content,main,.vod-page')||{}).innerText?document.querySelector('.home-shell-content,main,.vod-page').innerText.slice(0,100):''})`);
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await sleep(2000); return { whileOffline: off, latencyMs: await alive() };
  },
  async reloadWhilePlaying() { // F5 con el player abierto: debe volver a un estado sano
    await ensureHome(); await focusCard(60); await key('Enter'); await waitFor(() => q('.player-hud'), 8000, 200); await sleep(6000);
    await send('Page.reload', { ignoreCache: false }); await sleep(25000);
    return { pathAfter: await ev('location.pathname'), hudAfter: await q('.player-hud'), cards: await ev(`document.querySelectorAll('.channel-card').length`) };
  },
  async enterHold() { // OK mantenido (autoRepeat) sobre una tarjeta: debe abrir el player una sola vez
    await ensureHome(); await focusCard(55);
    for (let i = 0; i < 30; i++) { await key('Enter', { repeat: i > 0, hold: true }); await sleep(60); }
    await key('Enter'); await sleep(6000);
    const n = await ev(`document.querySelectorAll('video').length`);
    return { hud: await q('.player-hud'), videoElements: n, path: await ev('location.pathname') };
  },
  async epgHold() { // Guía: Abajo/Arriba mantenido de punta a punta y vuelta (ventana de filas)
    await ensureHome(); await ev(`history.pushState({},'','/home/epg');dispatchEvent(new PopStateEvent('popstate'));1`);
    await waitFor(() => ev(`document.querySelectorAll('.epg-cards-row').length>10`), 40000, 500); await sleep(3000);
    for (const k of ['ArrowDown', 'ArrowUp']) { for (let i = 0; i < 260; i++) { await key(k, { repeat: i > 0, hold: true }); await sleep(25); } await key(k); await sleep(1500); }
    const info = await ev(`(()=>{const a=document.activeElement;const row=a&&a.closest('.epg-cards-row');const ph=document.querySelectorAll('.epg-cards-row[data-placeholder]').length;const rows=document.querySelectorAll('.epg-cards-row').length;return JSON.stringify({activeRow:row?(row.querySelector('.epg-cards-channel-lcn')||{}).textContent:null,placeholders:ph,rows,mounted:rows-ph})})()`);
    return JSON.parse(info);
  },
  async catchupFlow() { // Catchup: fin de riel, Ver más, Atrás del modal, abrir evento y volver
    await ensureHome(); await ev(`history.pushState({},'','/home/catchup');dispatchEvent(new PopStateEvent('popstate'));1`);
    await waitFor(() => ev(`document.querySelectorAll('.catchup-card').length>5`), 60000, 500); await sleep(2000);
    await ev(`(()=>{const e=document.querySelector('.catchup-see-more-card');if(e){e.focus();e.scrollIntoView({block:'center',inline:'center'})}return 1})()`); await sleep(500);
    await key('Enter'); await sleep(2500); const modal = await q('.catchup-group-modal');
    await key('Escape'); await sleep(1500); const modalAfterBack = await q('.catchup-group-modal');
    await ev(`(()=>{const e=document.querySelector('.catchup-card:not(.catchup-see-more-card)');if(e)e.focus();return 1})()`); await key('Enter');
    await waitFor(() => q('.player-hud'), 10000, 300); await sleep(8000); const hud = await q('.player-hud');
    await key('Escape'); await sleep(2500);
    return { modalOpened: modal, modalAfterBack, hudOnEvent: hud, hudAfterBack: await q('.player-hud'), backOnCatchup: await ev(`location.pathname+' cards='+document.querySelectorAll('.catchup-card').length`) };
  },
  async searchWeird() { // buscador con entradas raras
    await ensureHome(); await ev(`history.pushState({},'','/home/buscador');dispatchEvent(new PopStateEvent('popstate'));1`);
    await waitFor(() => q('input'), 20000, 300); await sleep(1000);
    const inputs = ['', ' ', 'a', '%%%', '<img src=x onerror=alert(1)>', 'ñandú ça 日本語 😀', 'x'.repeat(3000), 'zzzzzzzqqq'];
    const out = [];
    for (const v of inputs) {
      await ev(`(()=>{const i=document.querySelector('input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
      await sleep(1800); out.push(await ev(`document.querySelectorAll('.search-result').length+'/'+(window.__xss||0)`));
    }
    return { results: out.join(' ') };
  },
  async chunkFail() { // el chunk de una sección no carga (red) y luego sí: no debe quedar la pantalla en blanco
    await ensureHome(); await send('Fetch.enable', { patterns: [{ urlPattern: '*OsmsPage*' }] });
    fetchMode = 'fail'; await ev(`history.pushState({},'','/home/osms');dispatchEvent(new PopStateEvent('popstate'));1`); await sleep(8000);
    await send('Page.captureScreenshot', { format: 'png' }).then((r) => import('node:fs').then((fs) => fs.writeFileSync('chunk-fail.png', Buffer.from(r.result.data, 'base64'))));
    const failed = await ev(`JSON.stringify({title:(document.querySelector('h1')||{}).textContent||'',nodes:document.getElementsByTagName('*').length,retryBtn:!!document.querySelector('button'),active:document.activeElement.tagName})`);
    fetchMode = null; await key('Enter'); await sleep(6000); return { whileFailing: failed, afterRetryEnter: await ev(`JSON.stringify({h1:(document.querySelector('h1')||{}).textContent||'',cards:document.querySelectorAll('.osms-page, .osms-list, h1').length})`) };
  },
  async chunkHtml() { // deploy nuevo con la app abierta: el chunk viejo devuelve HTML
    await ensureHome(); await send('Fetch.enable', { patterns: [{ urlPattern: '*OsmsPage*' }] });
    fetchMode = 'html'; await ev(`history.pushState({},'','/home/osms');dispatchEvent(new PopStateEvent('popstate'));1`); await sleep(12000);
    const r = await ev(`JSON.stringify({path:location.pathname,nodes:document.getElementsByTagName('*').length,retryBtn:!!document.querySelector('button')})`);
    fetchMode = null; return { whileHtml: r };
  },
  async hiddenVisible() { // pestaña oculta/visible (la TV hace esto al ir a otra app y volver)
    await ensureHome(); await focusCard(60); await key('Enter'); await waitFor(() => q('.player-hud'), 8000, 200); await sleep(5000);
    await ev(`Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));1`); await sleep(8000);
    await ev(`delete document.visibilityState;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));1`); await sleep(5000);
    return { playing: await ev(`(()=>{const v=document.querySelector('video');return !!v&&!v.paused})()`), latencyMs: await alive() };
  },
};

const list = which === 'all' ? Object.keys(SC) : which.split(',');
await ensureHome();
for (const name of list) {
  if (!SC[name]) { console.log('desconocido', name); continue; }
  const before = await ev('window.__chaos.errs.length'); const t0 = Date.now();
  let res; try { res = await SC[name](); } catch (e) { res = { crash: String(e) }; }
  const st = await state(); const errs = await newErrs(before);
  console.log(`## ${name} (${((Date.now() - t0) / 1000).toFixed(0)}s)`, JSON.stringify(res)); console.log('   estado', JSON.stringify(st)); if (errs.length) console.log('   ERRORES JS', JSON.stringify(errs));
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  fetchMode = null; await send('Fetch.disable');
  await ensureHome();
}
ws.close(); process.exit(0);
