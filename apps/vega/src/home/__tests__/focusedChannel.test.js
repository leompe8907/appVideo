import { describe, it, expect } from 'vitest';
import { getFocusedChannel, setFocusedChannel, subscribeFocusedChannel } from '../focusedChannel';

describe('focusedChannel', () => {
  it('avisa a los suscriptores sólo cuando cambia el canal', () => {
    const a = { id: 1 };
    let calls = 0;
    const unsubscribe = subscribeFocusedChannel(() => calls++);

    setFocusedChannel(a);
    setFocusedChannel(a);
    expect(getFocusedChannel()).toBe(a);
    expect(calls).toBe(1);

    unsubscribe();
    setFocusedChannel({ id: 2 });
    expect(calls).toBe(1);
  });
});
