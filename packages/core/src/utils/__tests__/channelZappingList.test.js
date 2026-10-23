import { describe, it, expect } from 'vitest';
import { findChannelByLcn } from '../channelZappingList';

const channels = [
  { id: 'a', lcn: 1 },
  { id: 'b', lcn: '12' },
  { id: 'c', lcn: 0 },
];

describe('findChannelByLcn', () => {
  it('encuentra el canal por número, venga el lcn como número o texto', () => {
    expect(findChannelByLcn(channels, 1)?.id).toBe('a');
    expect(findChannelByLcn(channels, 12)?.id).toBe('b');
  });

  it('sin coincidencia, o con 0 (canal sin número), devuelve null', () => {
    expect(findChannelByLcn(channels, 5)).toBeNull();
    expect(findChannelByLcn(channels, 0)).toBeNull();
    expect(findChannelByLcn(null, 1)).toBeNull();
  });
});
