import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startWebProbe } from '../webProbe';

describe('startWebProbe', () => {
  let sent;

  beforeEach(() => {
    sent = [];
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('XMLHttpRequest', class {
      open() {}
      setRequestHeader() {}
      send(body) { sent.push(JSON.parse(body)); }
    });
    document.body.innerHTML = '<div id="root"><button id="a">a</button><button id="b">b</button></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function events() {
    return sent.flatMap((b) => b.events);
  }

  it('manda boot, latido y primer foco sin tocar el DOM de la app', () => {
    const before = document.body.innerHTML;
    startWebProbe({ endpoint: 'http://collector/probe', label: 'test', flushMs: 1000 });
    document.getElementById('a').focus();
    vi.advanceTimersByTime(1100);

    const types = events().map((e) => e.t);
    expect(types).toContain('boot');
    expect(types).toContain('hb');
    expect(types).toContain('interactive');
    expect(sent[0].label).toBe('test');
    expect(document.body.innerHTML).toBe(before);
  });

  it('mide la latencia de una tecla que cambia una clase y marca la que no cambia nada', async () => {
    startWebProbe({ endpoint: 'http://collector/probe', flushMs: 5000 });

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 39 }));
    document.getElementById('b').className = 'focused';
    await Promise.resolve(); // MutationObserver corre como microtarea
    vi.advanceTimersByTime(100);

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 37 }));
    vi.advanceTimersByTime(6000);

    const keys = events().filter((e) => e.t === 'key');
    expect(keys[0].code).toBe(39);
    expect(typeof keys[0].lat).toBe('number');
    expect(keys[1]).toMatchObject({ code: 37, lat: null });
  });

  it('no rompe la app si el recolector falla', () => {
    vi.stubGlobal('XMLHttpRequest', class {
      open() { throw new Error('red caída'); }
    });
    expect(() => {
      startWebProbe({ endpoint: 'http://collector/probe', flushMs: 1000 });
      vi.advanceTimersByTime(2500);
    }).not.toThrow();
  });
});
