import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStallWatchdog } from '../stallWatchdog.js';

describe('createStallWatchdog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('si el buffering dura más que stallMs reintenta y vuelve a armar', () => {
    const onRetry = vi.fn();
    const w = createStallWatchdog({ stallMs: 20000, maxRetries: 3, onRetry, onGiveUp: vi.fn() });
    w.arm();
    vi.advanceTimersByTime(19999);
    expect(onRetry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20000);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('tras maxRetries intentos sin recuperar se rinde una sola vez', () => {
    const onRetry = vi.fn();
    const onGiveUp = vi.fn();
    const w = createStallWatchdog({ stallMs: 1000, maxRetries: 2, onRetry, onGiveUp });
    w.arm();
    vi.advanceTimersByTime(10000);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it('clear() (la reproducción avanza) cancela y reinicia los intentos', () => {
    const onRetry = vi.fn();
    const w = createStallWatchdog({ stallMs: 1000, maxRetries: 2, onRetry, onGiveUp: vi.fn() });
    w.arm();
    vi.advanceTimersByTime(1000);
    w.clear();
    vi.advanceTimersByTime(5000);
    expect(onRetry).toHaveBeenCalledTimes(1);
    w.arm();
    vi.advanceTimersByTime(1000);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('arm() repetido (varios eventos waiting) no reinicia el plazo', () => {
    const onRetry = vi.fn();
    const w = createStallWatchdog({ stallMs: 1000, maxRetries: 3, onRetry, onGiveUp: vi.fn() });
    w.arm();
    vi.advanceTimersByTime(600);
    w.arm();
    vi.advanceTimersByTime(400);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
