import { describe, it, expect } from 'vitest';
import { parseAdTarget } from '../adTarget';

describe('parseAdTarget', () => {
  it('stream_id, catchup_id y vod_id de genericData', () => {
    expect(parseAdTarget({ genericData: 'stream_id=12' })).toEqual({ kind: 'stream', id: 12 });
    expect(parseAdTarget({ genericData: 'catchup_id=34' })).toEqual({ kind: 'catchup', id: 34 });
    expect(parseAdTarget({ genericData: 'vod_id=56' })).toEqual({ kind: 'vod', id: 56 });
  });

  it('sin destino reconocible devuelve null', () => {
    expect(parseAdTarget({ genericData: 'stream_id=abc' })).toBeNull();
    expect(parseAdTarget({ genericData: 'otro=1' })).toBeNull();
    expect(parseAdTarget({})).toBeNull();
    expect(parseAdTarget(null)).toBeNull();
  });
});
