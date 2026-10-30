import { describe, it, expect } from 'vitest';
import { findChannelByLcn } from '../channelZappingList';

const channels = [
  { id: 'a', lcn: 1 },
  { id: 'b', lcn: '12' },
  { id: 'd', lcn: 20 },
  { id: 'c', lcn: 0 },
];

describe('findChannelByLcn', () => {
  it('encuentra el canal por número, venga el lcn como número o texto', () => {
    expect(findChannelByLcn(channels, 1)?.id).toBe('a');
    expect(findChannelByLcn(channels, 12)?.id).toBe('b');
  });

  it('si el número no existe, va al canal más cercano', () => {
    expect(findChannelByLcn(channels, 5)?.id).toBe('a');
    expect(findChannelByLcn(channels, 15)?.id).toBe('b');
    expect(findChannelByLcn(channels, 999)?.id).toBe('d');
  });

  it('a igual distancia gana el número más bajo', () => {
    expect(findChannelByLcn(channels, 16)?.id).toBe('b');
  });

  it('nunca elige un canal sin número (lcn 0); 0 o sin canales devuelve null', () => {
    expect(findChannelByLcn([{ id: 'c', lcn: 0 }], 3)).toBeNull();
    expect(findChannelByLcn(channels, 0)).toBeNull();
    expect(findChannelByLcn(null, 1)).toBeNull();
  });
});
