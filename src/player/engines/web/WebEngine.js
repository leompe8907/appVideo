import BaseEngine from '../base/BaseEngine';
import {
  DEFAULT_SEEK_STEP_SECONDS,
  DEFAULT_TIMEUPDATE_THROTTLE_MS,
  PLAYER_ENGINE_EVENTS,
  PLAYER_ENGINE_STATES,
} from '../contracts';

export class WebEngine extends BaseEngine {
  constructor() {
    super();
    this.video = null;
    this.container = null;
    this.lastTimeUpdateEmitMs = 0;
    this.timeUpdateThrottleMs = DEFAULT_TIMEUPDATE_THROTTLE_MS;
  }

  init(container) {
    if (!container) return;
    this.container = container;

    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.autoplay = false;
    video.controls = false;
    video.style.width = '100%';
    video.style.height = '100%';

    container.innerHTML = '';
    container.appendChild(video);
    this.video = video;

    this.attachEvents();
  }

  attachEvents() {
    if (!this.video) return;
    const v = this.video;

    v.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - this.lastTimeUpdateEmitMs < this.timeUpdateThrottleMs) {
        return;
      }
      this.lastTimeUpdateEmitMs = now;
      this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, {
        currentTime: v.currentTime,
        duration: v.duration,
      });
    });

    v.addEventListener('durationchange', () => {
      this.emit(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, { duration: v.duration });
    });

    v.addEventListener('ended', () => {
      this.emit(PLAYER_ENGINE_EVENTS.ENDED);
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.ENDED });
    });

    v.addEventListener('play', () => {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
    });

    v.addEventListener('pause', () => {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
    });

    v.addEventListener('seeking', () => {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKING });
    });

    v.addEventListener('seeked', () => {
      this.emit(PLAYER_ENGINE_EVENTS.SEEK_END, { currentTime: v.currentTime });
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKED });
    });

    v.addEventListener('error', () => {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, v.error || new Error('Unknown video error'));
    });
  }

  load(url, { type, autoPlay = false } = {}) {
    if (!this.video || !url) return;
    const v = this.video;
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADING, type });

    const onCanPlay = () => {
      v.removeEventListener('canplay', onCanPlay);
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADED, type });
      if (autoPlay) this.play();
    };
    v.addEventListener('canplay', onCanPlay, { once: true });

    v.src = url;
    v.load();
  }

  play() {
    if (!this.video) return;
    this.video
      .play()
      .catch((err) => {
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
      });
  }

  pause() {
    if (!this.video) return;
    this.video.pause();
  }

  stop() {
    if (!this.video) return;
    this.video.pause();
    this.video.currentTime = 0;
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
  }

  seek(seconds) {
    if (!this.video) return;
    const target = Number.isFinite(seconds) ? seconds : 0;
    this.emit(PLAYER_ENGINE_EVENTS.SEEK_START, { target });
    this.video.currentTime = Math.max(0, target);
  }

  forward(seconds = DEFAULT_SEEK_STEP_SECONDS) {
    if (!this.video) return;
    const step = Number.isFinite(seconds) ? seconds : DEFAULT_SEEK_STEP_SECONDS;
    this.seek((this.video.currentTime || 0) + step);
  }

  backward(seconds = DEFAULT_SEEK_STEP_SECONDS) {
    if (!this.video) return;
    const step = Number.isFinite(seconds) ? seconds : DEFAULT_SEEK_STEP_SECONDS;
    this.seek((this.video.currentTime || 0) - step);
  }

  setPlaybackRate(rate = 1) {
    if (!this.video) return;
    const normalized = Number.isFinite(rate) ? rate : 1;
    this.video.playbackRate = normalized;
  }

  setDimensions({ width, height, left, top } = {}) {
    if (!this.video) return;
    const style = this.video.style;
    if (Number.isFinite(width)) style.width = `${width}px`;
    if (Number.isFinite(height)) style.height = `${height}px`;
    if (Number.isFinite(left) || Number.isFinite(top)) {
      style.position = 'absolute';
      if (Number.isFinite(left)) style.left = `${left}px`;
      if (Number.isFinite(top)) style.top = `${top}px`;
    }
  }

  show() {
    if (!this.video) return;
    this.video.style.visibility = 'visible';
  }

  hide() {
    if (!this.video) return;
    this.video.style.visibility = 'hidden';
  }

  mute() {
    if (!this.video) return;
    this.video.muted = true;
  }

  unmute() {
    if (!this.video) return;
    this.video.muted = false;
  }

  destroy() {
    if (!this.video) return;
    try {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    } catch {
      // ignore
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.video = null;
    this.container = null;
  }
}

