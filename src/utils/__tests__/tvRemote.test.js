import { describe, it, expect } from 'vitest';
import { getTvActionFromKeyEvent, TV_ACTION } from '../tvRemote';

const ev = (keyCode, key = '') => ({ keyCode, key, code: '' });

describe('getTvActionFromKeyEvent', () => {
  it('Atrás: 461 (LG), 10009 (Samsung), Escape y Backspace', () => {
    expect(getTvActionFromKeyEvent(ev(461))).toBe(TV_ACTION.BACK);
    expect(getTvActionFromKeyEvent(ev(10009))).toBe(TV_ACTION.BACK);
    expect(getTvActionFromKeyEvent(ev(27, 'Escape'))).toBe(TV_ACTION.BACK);
    expect(getTvActionFromKeyEvent(ev(8, 'Backspace'))).toBe(TV_ACTION.BACK);
  });

  it('CH± de Samsung: 427 / 428', () => {
    expect(getTvActionFromKeyEvent(ev(427))).toBe(TV_ACTION.CHANNEL_UP);
    expect(getTvActionFromKeyEvent(ev(428))).toBe(TV_ACTION.CHANNEL_DOWN);
  });

  it('CH± de LG: 33 / 34 (PageUp / PageDown)', () => {
    expect(getTvActionFromKeyEvent(ev(33))).toBe(TV_ACTION.CHANNEL_UP);
    expect(getTvActionFromKeyEvent(ev(34))).toBe(TV_ACTION.CHANNEL_DOWN);
    expect(getTvActionFromKeyEvent(ev(0, 'PageUp'))).toBe(TV_ACTION.CHANNEL_UP);
    expect(getTvActionFromKeyEvent(ev(0, 'PageDown'))).toBe(TV_ACTION.CHANNEL_DOWN);
  });

  it('flechas y OK', () => {
    expect(getTvActionFromKeyEvent(ev(38))).toBe(TV_ACTION.UP);
    expect(getTvActionFromKeyEvent(ev(40))).toBe(TV_ACTION.DOWN);
    expect(getTvActionFromKeyEvent(ev(37))).toBe(TV_ACTION.LEFT);
    expect(getTvActionFromKeyEvent(ev(39))).toBe(TV_ACTION.RIGHT);
    expect(getTvActionFromKeyEvent(ev(13))).toBe(TV_ACTION.ENTER);
  });

  it('teclas de media (LG y Samsung)', () => {
    expect(getTvActionFromKeyEvent(ev(415))).toBe(TV_ACTION.PLAY);
    expect(getTvActionFromKeyEvent(ev(19))).toBe(TV_ACTION.PAUSE);
    expect(getTvActionFromKeyEvent(ev(10252))).toBe(TV_ACTION.PLAY_PAUSE);
    expect(getTvActionFromKeyEvent(ev(413))).toBe(TV_ACTION.STOP);
    expect(getTvActionFromKeyEvent(ev(417))).toBe(TV_ACTION.FAST_FORWARD);
    expect(getTvActionFromKeyEvent(ev(412))).toBe(TV_ACTION.REWIND);
    expect(getTvActionFromKeyEvent(ev(0, 'MediaPlayPause'))).toBe(TV_ACTION.PLAY_PAUSE);
    expect(getTvActionFromKeyEvent(ev(0, 'MediaPause'))).toBe(TV_ACTION.PAUSE);
  });

  it('teclas sin acción devuelven null', () => {
    expect(getTvActionFromKeyEvent(ev(65, 'a'))).toBeNull();
    expect(getTvActionFromKeyEvent(null)).toBeNull();
  });
});
