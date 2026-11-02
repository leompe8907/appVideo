import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';

const code = fs.readFileSync('public/tv-platform-bootstrap.js', 'utf8');

function runBootstrap({ protocol = 'http:', head = null, contentType, status = 200 } = {}) {
  const appended = [];
  const xhrCalls = [];
  class FakeXhr {
    open(method, url) {
      xhrCalls.push({ method, url });
    }

    getResponseHeader() {
      return contentType;
    }

    send() {
      this.status = status;
      queueMicrotask(() => this.onload());
    }
  }
  const fakeWindow = {
    navigator: { userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/68' },
    location: { protocol },
    document: {
      createElement: () => ({}),
      head: { appendChild: (el) => { appended.push(el); if (head) head(el); } },
    },
    XMLHttpRequest: FakeXhr,
  };
  new Function('window', 'globalThis', `${code}`)(fakeWindow, fakeWindow);
  return { fakeWindow, appended, xhrCalls };
}

describe('tv-platform-bootstrap (webOSTV.js)', () => {
  it('no carga webOSTV.js si el servidor responde con HTML (fallback de la SPA)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fakeWindow, appended, xhrCalls } = runBootstrap({ contentType: 'text/html; charset=utf-8' });
    const ready = await fakeWindow.__tvPlatformReady;
    expect(xhrCalls).toEqual([{ method: 'HEAD', url: 'webOSTV.js' }]);
    expect(appended).toHaveLength(0);
    expect(ready.platform).toBe('webos');
  });

  it('carga webOSTV.js cuando el servidor lo entrega como JavaScript', async () => {
    const { fakeWindow, appended } = runBootstrap({
      contentType: 'application/javascript',
      head: (el) => queueMicrotask(() => el.onload()),
    });
    await fakeWindow.__tvPlatformReady;
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe('webOSTV.js');
  });

  it('no carga nada si el archivo no existe (404)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fakeWindow, appended } = runBootstrap({ contentType: 'text/plain', status: 404 });
    await fakeWindow.__tvPlatformReady;
    expect(appended).toHaveLength(0);
  });

  it('en file:// (IPK empaquetado) lo carga directo, sin consultar por XHR', async () => {
    const { fakeWindow, appended, xhrCalls } = runBootstrap({
      protocol: 'file:',
      head: (el) => queueMicrotask(() => el.onload()),
    });
    await fakeWindow.__tvPlatformReady;
    expect(xhrCalls).toHaveLength(0);
    expect(appended).toHaveLength(1);
  });
});
