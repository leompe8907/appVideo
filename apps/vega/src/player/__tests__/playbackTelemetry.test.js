import { describe, it, expect } from 'vitest';
import { telemetryTargetForVodPlayer } from '../playbackTelemetry';

describe('telemetryTargetForVodPlayer', () => {
  it('VOD: tipo vod con el vodId y el ítem', () => {
    const item = { id: 12, name: 'Película' };
    expect(telemetryTargetForVodPlayer({ vodId: 12, item, title: 'Película' })).toEqual({ type: 'vod', id: 12, item });
  });

  it('catchup: tipo catchup con el catchupId y el evento', () => {
    const event = { id: 99, title: 'Partido' };
    expect(telemetryTargetForVodPlayer({ kind: 'catchup', catchupId: 99, item: event, url: 'x' })).toEqual({
      type: 'catchup',
      id: 99,
      item: event,
    });
  });

  it('sin id ni ítem no hay nada que registrar', () => {
    expect(telemetryTargetForVodPlayer({ url: 'x' })).toBeNull();
    expect(telemetryTargetForVodPlayer(undefined)).toBeNull();
  });
});
