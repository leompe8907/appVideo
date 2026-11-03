import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Reserva de la tarjeta del perfil: latir mientras se usa, reintentar sin red,
 * cortar cuando el backend dice que ya no es de este dispositivo y liberarla al
 * salir del perfil.
 */

vi.mock('../externalProfilesService', () => ({
  heartbeatProfileLease: vi.fn(),
  releaseProfileLease: vi.fn(async () => ({ status: 200, data: { success: true } })),
}));
const socket = vi.hoisted(() => ({ onLost: null }));
vi.mock('../deviceSessionService', () => ({
  setOnProfileLeaseLost: (fn) => {
    socket.onLost = fn;
  },
}));

import { heartbeatProfileLease, releaseProfileLease } from '../externalProfilesService';
import {
  RETRY_SECONDS,
  hasProfileLease,
  interpretHeartbeat,
  onLeaseLostByServer,
  setOnLeaseLost,
  startProfileLease,
  stopProfileLease,
} from '../profileLeaseKeeper';

const LEASE = { token: 'tok', licenseSn: 'SN1', heartbeatSeconds: 300 };
const active = (seconds = 280) => ({ status: 200, data: { success: true, leases: true, active: true, heartbeatSeconds: seconds } });

let lost;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  lost = vi.fn();
  setOnLeaseLost(lost);
});

afterEach(() => {
  stopProfileLease();
  vi.useRealTimers();
});

describe('interpretHeartbeat', () => {
  it('traduce cada respuesta del backend', () => {
    expect(interpretHeartbeat(active(250))).toEqual({ next: 'beat', seconds: 250 });
    expect(interpretHeartbeat({ status: 200, data: { active: false, reason: 'taken_over' } })).toEqual({
      next: 'lost',
      reason: 'taken_over',
    });
    expect(interpretHeartbeat({ status: 200, data: { active: true, leases: false } })).toEqual({ next: 'stop' });
    expect(interpretHeartbeat({ status: 400, data: { code: 'lease_token_invalid' } }).next).toBe('lost');
    expect(interpretHeartbeat({ status: 503, data: null })).toEqual({ next: 'retry' });
    expect(interpretHeartbeat({ status: 429, data: null })).toEqual({ next: 'retry' });
  });
});

describe('profileLeaseKeeper', () => {
  it('late con el intervalo que manda el backend', async () => {
    heartbeatProfileLease.mockResolvedValue(active(200));
    startProfileLease(LEASE);

    await vi.advanceTimersByTimeAsync(299_000);
    expect(heartbeatProfileLease).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(heartbeatProfileLease).toHaveBeenCalledWith('tok');
    await vi.advanceTimersByTimeAsync(200_000);
    expect(heartbeatProfileLease).toHaveBeenCalledTimes(2);
    expect(lost).not.toHaveBeenCalled();
  });

  it('sin red reintenta antes, sin perder la reserva', async () => {
    heartbeatProfileLease.mockRejectedValueOnce(new Error('sin red')).mockResolvedValue(active());
    startProfileLease(LEASE);

    await vi.advanceTimersByTimeAsync(300_000);
    await vi.advanceTimersByTimeAsync(RETRY_SECONDS * 1000);
    expect(heartbeatProfileLease).toHaveBeenCalledTimes(2);
    expect(hasProfileLease()).toBe(true);
    expect(lost).not.toHaveBeenCalled();
  });

  it('si otro dispositivo tomó la tarjeta, corta y avisa', async () => {
    heartbeatProfileLease.mockResolvedValue({ status: 200, data: { active: false, reason: 'taken_over' } });
    startProfileLease(LEASE);

    await vi.advanceTimersByTimeAsync(300_000);
    expect(lost).toHaveBeenCalledWith('taken_over');
    expect(hasProfileLease()).toBe(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(heartbeatProfileLease).toHaveBeenCalledTimes(1);
  });

  it('con las reservas apagadas en el backend deja de latir sin avisar', async () => {
    heartbeatProfileLease.mockResolvedValue({ status: 200, data: { active: true, leases: false } });
    startProfileLease(LEASE);

    await vi.advanceTimersByTimeAsync(900_000);
    expect(heartbeatProfileLease).toHaveBeenCalledTimes(1);
    expect(lost).not.toHaveBeenCalled();
  });

  it('el aviso del WebSocket solo cuenta para la tarjeta que se usa', () => {
    expect(socket.onLost).toBe(onLeaseLostByServer);
    startProfileLease(LEASE);

    socket.onLost({ reason: 'taken_over', licenseSn: 'OTRA' });
    expect(lost).not.toHaveBeenCalled();
    socket.onLost({ reason: 'taken_over', licenseSn: 'SN1' });
    expect(lost).toHaveBeenCalledWith('taken_over');
    expect(hasProfileLease()).toBe(false);
  });

  it('salir del perfil libera la tarjeta y no late más', async () => {
    startProfileLease(LEASE);
    stopProfileLease({ release: true });

    expect(releaseProfileLease).toHaveBeenCalledWith('tok');
    await vi.advanceTimersByTimeAsync(900_000);
    expect(heartbeatProfileLease).not.toHaveBeenCalled();
  });

  it('un latido que vuelve después de salir del perfil no avisa nada', async () => {
    let answer;
    heartbeatProfileLease.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    startProfileLease(LEASE);
    await vi.advanceTimersByTimeAsync(300_000);
    stopProfileLease();

    answer({ status: 200, data: { active: false, reason: 'released' } });
    await vi.advanceTimersByTimeAsync(0);
    expect(lost).not.toHaveBeenCalled();
  });
});
