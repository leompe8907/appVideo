import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChannelNumberInput } from '../channelNumberInput';

describe('createChannelNumberInput', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (maxDigits = 3) => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const input = createChannelNumberInput({ timeoutMs: 2000, maxDigits, onChange, onCommit });
    return { input, onChange, onCommit };
  };

  it('junta los dígitos y confirma el número tras la pausa', () => {
    const { input, onChange, onCommit } = setup();
    input.push(1);
    vi.advanceTimersByTime(1500);
    input.push(2);
    expect(onChange).toHaveBeenLastCalledWith('12');
    vi.advanceTimersByTime(1999);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledWith(12);
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('al llegar a maxDigits confirma sin esperar', () => {
    const { input, onCommit } = setup(2);
    input.push(0);
    input.push(7);
    expect(onCommit).toHaveBeenCalledWith(7);
    vi.advanceTimersByTime(5000);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('cancel descarta lo tecleado sin confirmar', () => {
    const { input, onChange, onCommit } = setup();
    input.push(4);
    input.cancel();
    vi.advanceTimersByTime(5000);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
