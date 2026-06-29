import Hls from 'hls.js';
import BaseEngine from '../base/BaseEngine';
import {
  DEFAULT_SEEK_STEP_SECONDS,
  DEFAULT_TIMEUPDATE_THROTTLE_MS,
  PLAYER_ENGINE_EVENTS,
  PLAYER_ENGINE_STATES,
} from '../contracts';
import { isHlsUrl } from './hlsSupport';
import { buildHlsPlaybackConfig } from './hlsPlaybackConfig';
import { isWindMiddlewareHost } from './windHlsManifest';
import { pickWindCompatibleLevel } from './windLevelSelect';

let videoElementIdSeq = 0;

/**
 * Motor web: hls.js directo + <video> nativo (sin Video.js).
 * Inicialización inmediata, zapping rápido, menor consumo de CPU y RAM.
 */
export class WebEngine extends BaseEngine {
  constructor() {
    super();
    this.video = null;
    this.hls = null;
    this.container = null;
    this._videoElementId = null;
    this.lastTimeUpdateEmitMs = 0;
    this.timeUpdateThrottleMs = DEFAULT_TIMEUPDATE_THROTTLE_MS;
    this._handlers = null;
    this._debug = false;
    this._lastTracksSnapshotKey = '';
  }

  _isDebugEnabled() {
    if (import.meta.env.DEV) return true;
    try {
      const params = new URLSearchParams(window.location.search);
      const v = String(params.get('playerDebug') || '').toLowerCase();
      if (v === '1' || v === 'true') return true;
    } catch {
      // noop
    }
    try {
      const v = String(localStorage.getItem('player.debug') || '').toLowerCase();
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  }

  _log(...args) {
    if (!this._debug) return;
    console.log('[WebEngine]', ...args);
  }

  _teardownMedia() {
    if (this.hls) {
      try {
        this.hls.detachMedia();
        this.hls.destroy();
      } catch (e) {
        this._log('Error destroying hls.js:', e);
      }
      this.hls = null;
    }

    if (this.video) {
      try {
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      } catch (e) {
        // noop
      }
    }
  }

  async init(container) {
    if (!container) return;

    this._debug = this._isDebugEnabled();
    this._log('init', { hasContainer: !!container });

    if (this._handlers) {
      this.detachEvents();
    }

    this._teardownMedia();
    this.container = container;

    const id = `app-main-video-${++videoElementIdSeq}`;
    const videoEl = document.createElement('video');
    videoEl.id = id;
    videoEl.className = 'w-100 h-100';
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.setAttribute('preload', 'auto');
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.backgroundColor = 'black';

    container.innerHTML = '';
    container.appendChild(videoEl);
    this._videoElementId = id;
    this.video = videoEl;

    this.attachEvents();
  }

  attachEvents() {
    if (!this.video) return;
    const video = this.video;

    if (this._handlers) {
      this.detachEvents();
    }

    this._handlers = {
      onTimeUpdate: () => {
        const now = Date.now();
        if (now - this.lastTimeUpdateEmitMs < this.timeUpdateThrottleMs) return;
        this.lastTimeUpdateEmitMs = now;
        this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, {
          currentTime: video.currentTime,
          duration: video.duration || 0,
        });
      },
      onDurationChange: () => {
        this.emit(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, { duration: video.duration || 0 });
      },
      onEnded: () => {
        this.emit(PLAYER_ENGINE_EVENTS.ENDED);
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.ENDED });
      },
      onPlay: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      },
      onPlaying: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      },
      onCanPlay: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADED });
      },
      onPause: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
      },
      onSeeking: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKING });
      },
      onSeeked: () => {
        this.emit(PLAYER_ENGINE_EVENTS.SEEK_END, { currentTime: video.currentTime });
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKED });
      },
      onError: (e) => {
        this._log('video element native error:', video.error);
        // Evitamos disparar error si acabamos de limpiar la reproducción
        if (video.error && video.error.code !== 4) {
          this.emit(PLAYER_ENGINE_EVENTS.ERROR, video.error || new Error('Error de reproducción nativo'));
        }
      },
    };

    video.addEventListener('timeupdate', this._handlers.onTimeUpdate);
    video.addEventListener('durationchange', this._handlers.onDurationChange);
    video.addEventListener('ended', this._handlers.onEnded);
    video.addEventListener('play', this._handlers.onPlay);
    video.addEventListener('playing', this._handlers.onPlaying);
    video.addEventListener('canplay', this._handlers.onCanPlay);
    video.addEventListener('pause', this._handlers.onPause);
    video.addEventListener('seeking', this._handlers.onSeeking);
    video.addEventListener('seeked', this._handlers.onSeeked);
    video.addEventListener('error', this._handlers.onError);
  }

  detachEvents() {
    if (!this.video || !this._handlers) return;
    const video = this.video;
    video.removeEventListener('timeupdate', this._handlers.onTimeUpdate);
    video.removeEventListener('durationchange', this._handlers.onDurationChange);
    video.removeEventListener('ended', this._handlers.onEnded);
    video.removeEventListener('play', this._handlers.onPlay);
    video.removeEventListener('playing', this._handlers.onPlaying);
    video.removeEventListener('canplay', this._handlers.onCanPlay);
    video.removeEventListener('pause', this._handlers.onPause);
    video.removeEventListener('seeking', this._handlers.onSeeking);
    video.removeEventListener('seeked', this._handlers.onSeeked);
    video.removeEventListener('error', this._handlers.onError);
    this._handlers = null;
  }

  load(url, { type, autoPlay = false } = {}) {
    if (!this.video || !url) return;

    this._debug = this._isDebugEnabled();
    this._log('load', { url, type, autoPlay, isHls: isHlsUrl(url) });
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADING, type });

    this._teardownMedia();

    const useHls = isHlsUrl(url);

    if (useHls && Hls.isSupported()) {
      const config = buildHlsPlaybackConfig(url);
      this._log('Instantiating hls.js with config', config);

      const hls = new Hls(config);
      this.hls = hls;

      hls.loadSource(url);
      hls.attachMedia(this.video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this._log('hls.js: manifest parsed');
        this._emitTracksChange();
        if (autoPlay) this.play();
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this._emitTracksChange());
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this._emitTracksChange());
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, () => this._emitTracksChange());
      hls.on(Hls.Events.AUDIO_TRACK_SWITCH, () => this._emitTracksChange());

      // Manejo de errores fatales y re-intentos automáticos
      hls.on(Hls.Events.ERROR, (event, data) => {
        this._log('hls.js error event:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              this._log('Fatal network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              this._log('Fatal media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              this._log('Fatal unrecoverable error');
              this.emit(PLAYER_ENGINE_EVENTS.ERROR, data.error || new Error(`Hls.js error: ${data.details}`));
              break;
          }
        }
      });

      if (isWindMiddlewareHost(url)) {
        const lock = () => pickWindCompatibleLevel(hls);
        hls.on(Hls.Events.MANIFEST_PARSED, lock);
        if (hls.levels?.length) lock();
      }

    } else {
      // Fallback para Safari, iOS o streams MP4 progresivos
      this._log('Falling back to native browser playback');
      this.video.src = url;
      this.video.load();

      const onCanPlay = () => {
        this.video.removeEventListener('canplay', onCanPlay);
        this._emitTracksChange();
        if (autoPlay) this.play();
      };
      this.video.addEventListener('canplay', onCanPlay);
    }
  }

  play() {
    if (!this.video) return;
    this._log('play()');
    const p = this.video.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (err?.name === 'AbortError') return;
        this._log('play() error', err);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
      });
    }
  }

  pause() {
    if (!this.video) return;
    this._log('pause()');
    this.video.pause();
  }

  stop() {
    this.reset();
  }

  reset() {
    this._log('reset()');
    this._lastTracksSnapshotKey = '';
    this._teardownMedia();
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
    this._log('destroy()');
    this.detachEvents();
    this._teardownMedia();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
    this.video = null;
  }

  getTracks() {
    const audio = [];
    const text = [];
    let selectedAudioId = null;
    let selectedTextId = null;
    let textEnabled = false;

    if (this.hls) {
      const audioTracks = this.hls.audioTracks || [];
      audioTracks.forEach((track) => {
        const id = String(track.id);
        audio.push({
          id,
          label: track.name || track.lang || `Audio ${track.id + 1}`,
          lang: track.lang || '',
          index: track.id,
        });
      });
      const activeAudio = this.hls.audioTrack;
      if (activeAudio >= 0 && audioTracks[activeAudio]) {
        selectedAudioId = String(audioTracks[activeAudio].id);
      }

      const subtitleTracks = this.hls.subtitleTracks || [];
      subtitleTracks.forEach((track) => {
        const id = String(track.id);
        text.push({
          id,
          label: track.name || track.lang || `Sub ${track.id + 1}`,
          lang: track.lang || '',
          index: track.id,
        });
      });
      const activeSubtitle = this.hls.subtitleTrack;
      if (activeSubtitle >= 0 && subtitleTracks[activeSubtitle]) {
        selectedTextId = String(subtitleTracks[activeSubtitle].id);
        textEnabled = true;
      }
    } else if (this.video) {
      const textTracks = Array.from(this.video.textTracks || []);
      textTracks.forEach((track, idx) => {
        const id = String(idx);
        text.push({
          id,
          label: track.label || track.language || `Sub ${idx + 1}`,
          lang: track.language || '',
          index: idx,
        });
        if (track.mode === 'showing') {
          selectedTextId = id;
          textEnabled = true;
        }
      });
    }

    return { audio, text, selectedAudioId, selectedTextId, textEnabled };
  }

  selectAudioTrack(id) {
    if (!this.hls) return false;
    const tracks = this.hls.audioTracks || [];
    const idx = tracks.findIndex((t) => String(t.id) === String(id));
    if (idx >= 0) {
      this.hls.audioTrack = idx;
      this._emitTracksChange();
      return true;
    }
    return false;
  }

  selectTextTrack(id) {
    if (this.hls) {
      const tracks = this.hls.subtitleTracks || [];
      const idx = tracks.findIndex((t) => String(t.id) === String(id));
      if (idx >= 0) {
        this.hls.subtitleTrack = idx;
        this._emitTracksChange();
        return true;
      }
    } else if (this.video) {
      const tracks = Array.from(this.video.textTracks || []);
      tracks.forEach((track, idx) => {
        track.mode = String(idx) === String(id) ? 'showing' : 'disabled';
      });
      this._emitTracksChange();
      return true;
    }
    return false;
  }

  setSubtitlesEnabled(enabled) {
    const want = enabled === true;
    if (this.hls) {
      if (!want) {
        this.hls.subtitleTrack = -1;
      } else if (this.hls.subtitleTrack === -1 && this.hls.subtitleTracks?.length > 0) {
        this.hls.subtitleTrack = 0;
      }
      this._emitTracksChange();
      return true;
    } else if (this.video) {
      const tracks = Array.from(this.video.textTracks || []);
      if (tracks.length === 0) return false;
      tracks.forEach((track) => {
        track.mode = want ? 'showing' : 'disabled';
      });
      this._emitTracksChange();
      return true;
    }
    return false;
  }

  _emitTracksChange() {
    try {
      const snap = this.getTracks();
      const key = JSON.stringify({
        a: snap.audio.map((t) => t.id),
        t: snap.text.map((t) => t.id),
        sa: snap.selectedAudioId,
        st: snap.selectedTextId,
        te: snap.textEnabled,
      });
      if (key === this._lastTracksSnapshotKey) return;
      this._lastTracksSnapshotKey = key;
      this.emit(PLAYER_ENGINE_EVENTS.TRACKS_CHANGE, snap);
    } catch {
      // noop
    }
  }
}
