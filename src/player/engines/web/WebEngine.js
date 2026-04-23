import Hls from 'hls.js';
import BaseEngine from '../base/BaseEngine';
import {
  DEFAULT_SEEK_STEP_SECONDS,
  DEFAULT_TIMEUPDATE_THROTTLE_MS,
  PLAYER_ENGINE_EVENTS,
  PLAYER_ENGINE_STATES,
} from '../contracts';
import { isHlsUrl } from './hlsSupport';

export class WebEngine extends BaseEngine {
  constructor() {
    super();
    this.video = null;
    this.container = null;
    this.hls = null;
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

  _tearDownHls() {
    if (!this.hls) return;
    try {
      this.hls.destroy();
    } catch {
      // noop
    }
    this.hls = null;
  }

  init(container) {
    if (!container) return;

    this._debug = this._isDebugEnabled();
    this._log('init', { hasContainer: !!container });
    
    // If we are moving to a new container or re-initializing, detach old events safely
    if (this._handlers) {
      this.detachEvents();
    }
    
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

    if (this._handlers) {
      this.detachEvents();
    }

    this._handlers = {
      onTimeUpdate: () => {
      const now = Date.now();
      if (now - this.lastTimeUpdateEmitMs < this.timeUpdateThrottleMs) {
        return;
      }
      this.lastTimeUpdateEmitMs = now;
      this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, {
        currentTime: v.currentTime,
        duration: v.duration,
      });
      },
      onLoadedMetadata: () => {
        this._log('video:loadedmetadata', {
          duration: v.duration,
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
        });
      },
      onWaiting: () => {
        this._log('video:waiting');
      },
      onStalled: () => {
        this._log('video:stalled');
      },
      onPlaying: () => {
        this._log('video:playing');
      },
      onCanPlay: () => {
        this._log('video:canplay');
      },
      onDurationChange: () => {
        this.emit(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, { duration: v.duration });
      },
      onEnded: () => {
        this.emit(PLAYER_ENGINE_EVENTS.ENDED);
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.ENDED });
      },
      onPlay: () => {
        this._log('video:play');
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      },
      onPause: () => {
        this._log('video:pause');
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
      },
      onSeeking: () => {
        this._log('video:seeking', { currentTime: v.currentTime });
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKING });
      },
      onSeeked: () => {
        this._log('video:seeked', { currentTime: v.currentTime });
        this.emit(PLAYER_ENGINE_EVENTS.SEEK_END, { currentTime: v.currentTime });
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKED });
      },
      onError: () => {
        this._log('video:error', v.error);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, v.error || new Error('Unknown video error'));
      },
    };

    v.addEventListener('timeupdate', this._handlers.onTimeUpdate);
    v.addEventListener('loadedmetadata', this._handlers.onLoadedMetadata);
    v.addEventListener('waiting', this._handlers.onWaiting);
    v.addEventListener('stalled', this._handlers.onStalled);
    v.addEventListener('playing', this._handlers.onPlaying);
    v.addEventListener('canplay', this._handlers.onCanPlay);
    v.addEventListener('durationchange', this._handlers.onDurationChange);
    v.addEventListener('ended', this._handlers.onEnded);
    v.addEventListener('play', this._handlers.onPlay);
    v.addEventListener('pause', this._handlers.onPause);
    v.addEventListener('seeking', this._handlers.onSeeking);
    v.addEventListener('seeked', this._handlers.onSeeked);
    v.addEventListener('error', this._handlers.onError);
  }

  detachEvents() {
    if (!this.video || !this._handlers) return;
    const v = this.video;
    v.removeEventListener('timeupdate', this._handlers.onTimeUpdate);
    v.removeEventListener('loadedmetadata', this._handlers.onLoadedMetadata);
    v.removeEventListener('waiting', this._handlers.onWaiting);
    v.removeEventListener('stalled', this._handlers.onStalled);
    v.removeEventListener('playing', this._handlers.onPlaying);
    v.removeEventListener('canplay', this._handlers.onCanPlay);
    v.removeEventListener('durationchange', this._handlers.onDurationChange);
    v.removeEventListener('ended', this._handlers.onEnded);
    v.removeEventListener('play', this._handlers.onPlay);
    v.removeEventListener('pause', this._handlers.onPause);
    v.removeEventListener('seeking', this._handlers.onSeeking);
    v.removeEventListener('seeked', this._handlers.onSeeked);
    v.removeEventListener('error', this._handlers.onError);
    this._handlers = null;
  }

  load(url, { type, autoPlay = false } = {}) {
    if (!this.video || !url) return;
    const v = this.video;
    this._debug = this._isDebugEnabled();
    this._log('load', { url, type, autoPlay, isHls: isHlsUrl(url) });
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADING, type });

    this._tearDownHls();
    try {
      v.removeAttribute('src');
      if (v.srcObject) v.srcObject = null;
      v.load();
    } catch {
      // noop
    }

    const emitLoadedAndMaybePlay = () => {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADED, type });
      if (autoPlay) this.play();
    };

    if (!isHlsUrl(url)) {
      const onCanPlay = () => {
        v.removeEventListener('canplay', onCanPlay);
        emitLoadedAndMaybePlay();
      };
      v.addEventListener('canplay', onCanPlay, { once: true });
      v.src = url;
      v.load();
      return;
    }

    // HLS: Safari / iOS reproducen nativamente; Chrome/Firefox en escritorio necesitan hls.js (paridad 10foot + Video.js/hlsjs).
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      const onCanPlay = () => {
        v.removeEventListener('canplay', onCanPlay);
        emitLoadedAndMaybePlay();
      };
      v.addEventListener('canplay', onCanPlay, { once: true });
      v.src = url;
      v.load();
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
      });
      this.hls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this._log('hls:MANIFEST_PARSED');
        emitLoadedAndMaybePlay();
        this._emitTracksChange();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this._emitTracksChange());
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => this._emitTracksChange());
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this._emitTracksChange());
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, () => this._emitTracksChange());

      hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
        this._log('hls:FRAG_LOADING', { sn: data?.frag?.sn, url: data?.frag?.url });
      });

      hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
        this._log('hls:FRAG_LOADED', { sn: data?.frag?.sn, url: data?.frag?.url, size: data?.payload?.byteLength });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        this._log('hls:ERROR', {
          fatal: !!data?.fatal,
          type: data?.type,
          details: data?.details,
          reason: data?.reason,
          response: data?.response,
        });
        if (!data?.fatal) return;
        const msg = data.details || data.type || 'Error HLS';
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, new Error(String(msg)));
      });

      hls.loadSource(url);
      hls.attachMedia(v);
      return;
    }

    this.emit(
      PLAYER_ENGINE_EVENTS.ERROR,
      new Error('HLS no disponible: usa Safari o un navegador con Media Source Extensions.'),
    );
  }

  play() {
    if (!this.video) return;
    this._log('play()');
    this.video
      .play()
      .catch((err) => {
        this._log('play() error', err);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
      });
  }

  pause() {
    if (!this.video) return;
    this._log('pause()');
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
    this._debug = this._isDebugEnabled();
    this._log('destroy()');
    this._tearDownHls();
    this.detachEvents();
    try {
      this.video.pause();
      this.video.removeAttribute('src');
      if (this.video.srcObject) this.video.srcObject = null;
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

  // ───────────────────────────────────────────────────────────────────────────
  // Tracks (Audio/Subtítulos) - Web/HLS
  // ───────────────────────────────────────────────────────────────────────────

  getTracks() {
    const audio = [];
    const text = [];
    let selectedAudioId = null;
    let selectedTextId = null;
    let textEnabled = false;

    const hls = this.hls;
    if (hls) {
      const audioTracks = Array.isArray(hls.audioTracks) ? hls.audioTracks : [];
      const currentAudio = Number.isFinite(hls.audioTrack) ? hls.audioTrack : -1;
      audioTracks.forEach((t, idx) => {
        const id = String(t?.id ?? idx);
        audio.push({
          id,
          label: t?.name || t?.lang || `Audio ${idx + 1}`,
          lang: t?.lang || '',
          index: idx,
        });
      });
      if (currentAudio >= 0 && audioTracks[currentAudio]) {
        selectedAudioId = String(audioTracks[currentAudio]?.id ?? currentAudio);
      }

      const subTracks = Array.isArray(hls.subtitleTracks) ? hls.subtitleTracks : [];
      const currentSub = Number.isFinite(hls.subtitleTrack) ? hls.subtitleTrack : -1;
      subTracks.forEach((t, idx) => {
        const id = String(t?.id ?? idx);
        text.push({
          id,
          label: t?.name || t?.lang || `Sub ${idx + 1}`,
          lang: t?.lang || '',
          index: idx,
        });
      });
      if (currentSub >= 0 && subTracks[currentSub]) {
        selectedTextId = String(subTracks[currentSub]?.id ?? currentSub);
        textEnabled = true;
      } else {
        textEnabled = false;
      }

      return { audio, text, selectedAudioId, selectedTextId, textEnabled };
    }

    // Fallback: HTML5 textTracks (sin HLS.js)
    const v = this.video;
    const tt = v?.textTracks ? Array.from(v.textTracks) : [];
    tt.forEach((track, idx) => {
      const id = String(idx);
      text.push({
        id,
        label: track?.label || track?.language || `Sub ${idx + 1}`,
        lang: track?.language || '',
        index: idx,
      });
      if (track?.mode === 'showing') {
        selectedTextId = id;
        textEnabled = true;
      }
    });
    return { audio, text, selectedAudioId, selectedTextId, textEnabled };
  }

  selectAudioTrack(id) {
    const hls = this.hls;
    if (!hls) return false;
    const idx = (Array.isArray(hls.audioTracks) ? hls.audioTracks : []).findIndex((t, i) => String(t?.id ?? i) === String(id));
    if (idx < 0) return false;
    hls.audioTrack = idx;
    this._emitTracksChange();
    return true;
  }

  setSubtitlesEnabled(enabled) {
    const want = enabled === true;
    const hls = this.hls;
    if (hls) {
      if (!want) {
        hls.subtitleTrack = -1;
        this._emitTracksChange();
        return true;
      }
      // Si no hay seleccionado, tomar el primero disponible
      if (!Number.isFinite(hls.subtitleTrack) || hls.subtitleTrack < 0) {
        if ((hls.subtitleTracks || []).length > 0) {
          hls.subtitleTrack = 0;
          this._emitTracksChange();
          return true;
        }
      }
      this._emitTracksChange();
      return true;
    }

    const v = this.video;
    if (!v?.textTracks) return false;
    const list = Array.from(v.textTracks);
    list.forEach((tr) => {
      // showing/disabled es lo más compatible
      tr.mode = want ? 'showing' : 'disabled';
    });
    this._emitTracksChange();
    return true;
  }

  selectTextTrack(id) {
    const hls = this.hls;
    if (hls) {
      const idx = (Array.isArray(hls.subtitleTracks) ? hls.subtitleTracks : []).findIndex((t, i) => String(t?.id ?? i) === String(id));
      if (idx < 0) return false;
      hls.subtitleTrack = idx;
      this._emitTracksChange();
      return true;
    }
    const v = this.video;
    if (!v?.textTracks) return false;
    const list = Array.from(v.textTracks);
    const idx = Number(id);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) return false;
    list.forEach((tr, i) => {
      tr.mode = i === idx ? 'showing' : 'disabled';
    });
    this._emitTracksChange();
    return true;
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

