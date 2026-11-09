import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createAsyncBackedStorage,
  createMemoryStorage,
  getStorage,
  setStorageBackend,
  storageGet,
  storageKeys,
  storageRemove,
  storageSet,
} from '../storage.js';

function fakeAsyncStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getAllKeys: vi.fn(async () => Array.from(data.keys())),
    multiGet: vi.fn(async (keys) => keys.map((k) => [k, data.has(k) ? data.get(k) : null])),
    multiSet: vi.fn(async (pairs) => pairs.forEach(([k, v]) => data.set(k, v))),
    multiRemove: vi.fn(async (keys) => keys.forEach((k) => data.delete(k))),
  };
}

afterEach(() => {
  setStorageBackend(null);
  localStorage.clear();
});

describe('getStorage', () => {
  it('usa localStorage por defecto', () => {
    storageSet('a', 1);
    expect(localStorage.getItem('a')).toBe('1');
    expect(getStorage()).toBe(localStorage);
  });

  it('usa el backend registrado', () => {
    const memory = createMemoryStorage();
    setStorageBackend(memory);
    storageSet('a', 'x');
    expect(memory.getItem('a')).toBe('x');
    expect(localStorage.getItem('a')).toBeNull();
  });

  it('las funciones seguras no lanzan si el backend falla', () => {
    setStorageBackend({
      getItem() { throw new Error('boom'); },
      setItem() { throw new Error('boom'); },
      removeItem() { throw new Error('boom'); },
      key() { throw new Error('boom'); },
      length: 1,
    });
    expect(storageGet('a')).toBeNull();
    expect(() => storageSet('a', 'b')).not.toThrow();
    expect(() => storageRemove('a')).not.toThrow();
    expect(storageKeys()).toEqual([]);
  });
});

describe('createMemoryStorage', () => {
  it('se comporta como Storage y avisa los cambios', () => {
    const onChange = vi.fn();
    const s = createMemoryStorage({ a: '1' }, onChange);
    s.setItem('b', 2);
    s.setItem('b', '2'); // sin cambio: no avisa
    s.removeItem('a');
    s.removeItem('zz'); // inexistente: no avisa
    expect(s.length).toBe(1);
    expect(s.key(0)).toBe('b');
    expect(s.key(5)).toBeNull();
    expect(s.getItem('a')).toBeNull();
    expect(onChange.mock.calls).toEqual([['b', '2'], ['a', null]]);
  });
});

describe('createAsyncBackedStorage', () => {
  it('carga los datos existentes y escribe por detrás agrupando cambios', async () => {
    const async = fakeAsyncStorage({ brand: 'intv', old: 'x' });
    const s = await createAsyncBackedStorage(async, { flushDelayMs: 0 });
    expect(s.getItem('brand')).toBe('intv');

    s.setItem('sessionId', 'abc');
    s.setItem('sessionId', 'def');
    s.removeItem('old');
    await s.flush();

    expect(async.multiSet).toHaveBeenCalledTimes(1);
    expect(async.multiRemove).toHaveBeenCalledWith(['old']);
    const { __appvideo_storage_keys: index, ...data } = Object.fromEntries(async.data);
    expect(data).toEqual({ brand: 'intv', sessionId: 'def' });
    expect(JSON.parse(index).sort()).toEqual(['brand', 'sessionId']);
  });

  it('si getAllKeys falla, carga las claves desde su índice', async () => {
    const first = fakeAsyncStorage();
    const s1 = await createAsyncBackedStorage(first, { flushDelayMs: 0 });
    s1.setItem('intv.sessionId', 'abc');
    await s1.flush();

    first.getAllKeys.mockRejectedValue(new Error('no soportado'));
    const s2 = await createAsyncBackedStorage(first, { onError: () => {} });
    expect(s2.getItem('intv.sessionId')).toBe('abc');
    expect(s2.length).toBe(1);
  });

  it('arranca vacío si AsyncStorage falla al cargar', async () => {
    const async = fakeAsyncStorage();
    async.getAllKeys.mockRejectedValueOnce(new Error('io'));
    const onError = vi.fn();
    const s = await createAsyncBackedStorage(async, { onError });
    expect(s.length).toBe(0);
    expect(onError).toHaveBeenCalled();
  });
});

describe('onStorageBackendChange', () => {
  it('avisa al cambiar el backend y deja de avisar al desuscribirse', async () => {
    const { onStorageBackendChange } = await import('../storage.js');
    const listener = vi.fn();
    const stop = onStorageBackendChange(listener);
    setStorageBackend(createMemoryStorage());
    stop();
    setStorageBackend(null);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
