import { videojs } from '../../vendor/videojsAssign.js';
import '../../vendor/videojs-hlsjs-plugin.js';
import 'video.js/dist/video-js.css';
import BaseEngine from '../base/BaseEngine';
import {
  DEFAULT_SEEK_STEP_SECONDS,
  DEFAULT_TIMEUPDATE_THROTTLE_MS,
  PLAYER_ENGINE_EVENTS,
  PLAYER_ENGINE_STATES,
} from '../contracts';
import { isHlsUrl } from './hlsSupport';
import {
  applyStreamrootHlsSessionConfig,
  buildStreamrootHlsPluginOptions,
} from './sessionHlsXhr';
import { isWindMiddlewareHost } from './windHlsManifest';
import { createWindModernHls, destroyWindModernHls } from './windModernHls';

let videoElementIdSeq = 0;

/**
 * Motor web con Video.js + plugin hls.js (paridad 10foot / nbplayer).
 */
export class WebEngine extends BaseEngine {
  constructor() {
    super();
    this.player = null;
    this.video = null;
    this.container = null;
    this._videoElementId = null;
    this.lastTimeUpdateEmitMs = 0;
    this.timeUpdateThrottleMs = DEFAULT_TIMEUPDATE_THROTTLE_MS;
    this._handlers = null;
    this._debug = false;
    this._lastTracksSnapshotKey = '';
    this._windBlobUrl = null;
    this._windDirectMode = false;
    this._windModernHls = null;
    this._windVideoHandlers = null;
    this._suppressVjsErrors = false;
    this._windLevelAttempt = 0;
  }

  _destroyWindModernHls() {
    if (this._windModernHls) {
      destroyWindModernHls({ hls: this._windModernHls });
      this._windModernHls = null;
    }
  }

  _revokeWindBlob() {
    if (this._windBlobUrl) {
      try {
        URL.revokeObjectURL(this._windBlobUrl);
      } catch {
        // noop
      }
      this._windBlobUrl = null;
    }
  }

  _getTechVideo(player = this.player) {
    if (!player) return null;
    return player.el()?.querySelector?.('video') || player.el() || null;
  }

  _disposeHlsSource(player) {
    if (!player) return;
    this._suppressVjsErrors = true;
    try {
      const tech = player.tech(true);
      if (tech?.hlsProvider?.dispose) {
        tech.hlsProvider.dispose();
        tech.hlsProvider = null;
      }
    } catch {
      // noop
    }
    const videoEl = this._getTechVideo(player);
    if (videoEl) {
      try {
        videoEl.removeAttribute('src');
        videoEl.load();
      } catch {
        // noop
      }
    }
    queueMicrotask(() => {
      this._suppressVjsErrors = false;
    });
  }

  _clearWindDirectMode() {
    this._windDirectMode = false;
    this._unbindWindVideoHandlers();
  }

  _bindWindVideoHandlers(player, { autoPlay } = {}) {
    const videoEl = this._getTechVideo(player);
    if (!videoEl) return;

    this._unbindWindVideoHandlers();

    this._windVideoHandlers = {
      onError: () => {
        const err = videoEl.error;
        this._log('wind native:error', err);
        this.emit(
          PLAYER_ENGINE_EVENTS.ERROR,
          err || new Error('Error de reproducción HLS nativo (Wind)'),
        );
      },
      onTimeUpdate: () => {
        const now = Date.now();
        if (now - this.lastTimeUpdateEmitMs < this.timeUpdateThrottleMs) return;
        this.lastTimeUpdateEmitMs = now;
        this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, {
          currentTime: videoEl.currentTime,
          duration: Number.isFinite(videoEl.duration) ? videoEl.duration : 0,
        });
      },
      onPlay: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      },
      onPause: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
      },
    };

    videoEl.addEventListener('error', this._windVideoHandlers.onError);
    videoEl.addEventListener('timeupdate', this._windVideoHandlers.onTimeUpdate);
    videoEl.addEventListener('play', this._windVideoHandlers.onPlay);
    videoEl.addEventListener('pause', this._windVideoHandlers.onPause);
  }

  _unbindWindVideoHandlers() {
    const videoEl = this._getTechVideo();
    const h = this._windVideoHandlers;
    if (!videoEl || !h) {
      this._windVideoHandlers = null;
      return;
    }
    videoEl.removeEventListener('error', h.onError);
    videoEl.removeEventListener('timeupdate', h.onTimeUpdate);
    videoEl.removeEventListener('play', h.onPlay);
    videoEl.removeEventListener('pause', h.onPause);
    this._windVideoHandlers = null;
  }

  _loadWindStream(player, url, { autoPlay = false, type } = {}) {
    this._windLevelAttempt = 0;
    this._revokeWindBlob();
    this._clearWindDirectMode();
    this._destroyWindModernHls();
    this._disposeHlsSource(player);

    const videoEl = this._getTechVideo(player);
    if (!videoEl) {
      this.emit(PLAYER_ENGINE_EVENTS.ERROR, new Error('Sin elemento video para Wind'));
      return;
    }

    const onLoaded = () => {
      this._windDirectMode = true;
      this._log('wind modern hls loaded');
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADED, type });
      this._emitTracksChange();
      this._bindWindVideoHandlers(player, { autoPlay });
      // play() lo dispara windModernHls tras FRAG_BUFFERED (evita play antes de buffer)
      if (autoPlay && videoEl.readyState >= 2) {
        videoEl.play().catch((err) => {
          if (err?.name === 'AbortError') return;
          this._log('wind play error', err);
          this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
        });
      }
    };

    createWindModernHls(videoEl, url, {
      onLoaded,
      onError: (data) => {
        this._log('wind modern hls fatal', data);
        this._destroyWindModernHls();
        this._revokeWindBlob();
        this._clearWindDirectMode();
        const msg =
          data?.details === 'codecUnsupported' ||
          data?.details === 'bufferIncompatibleCodecsError' ||
          data?.details === 'bufferAddCodecError'
            ? 'Audio/vídeo no compatible con el navegador (suele ser AC-3 o MPEG-2; en web hace falta H.264 + AAC)'
            : data?.details || data?.type || 'Error HLS Wind';
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, new Error(msg));
      },
    })
      .then(({ hls, blobUrl }) => {
        this._windModernHls = hls;
        if (blobUrl) this._windBlobUrl = blobUrl;
      })
      .catch((err) => {
        this._log('wind modern hls init failed', err);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
      });
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

  _disposePlayer() {
    this._revokeWindBlob();
    this._destroyWindModernHls();
    this._clearWindDirectMode();
    if (!this.player) return;
    try {
      this.player.dispose();
    } catch {
      // noop
    }
    this.player = null;
    this.video = null;
    this._videoElementId = null;
  }

  init(container) {
    if (!container) return;

    this._debug = this._isDebugEnabled();
    this._log('init', { hasContainer: !!container });

    if (this._handlers) {
      this.detachEvents();
    }

    this._disposePlayer();
    this.container = container;

    const id = `app-main-video-${++videoElementIdSeq}`;
    const videoEl = document.createElement('video');
    videoEl.id = id;
    videoEl.className = 'video-js vjs-default-skin';
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.setAttribute('preload', 'auto');
    videoEl.setAttribute('data-setup', '{"fluid": false}');
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';

    container.innerHTML = '';
    container.appendChild(videoEl);
    this._videoElementId = id;

    this.player = videojs(id, {
      controls: false,
      autoplay: false,
      preload: 'auto',
      fluid: false,
      inactivityTimeout: 0,
      ...buildStreamrootHlsPluginOptions(),
    });
    applyStreamrootHlsSessionConfig(this.player);

    if (this._debug) {
      this._log('videojs+hls', {
        hasWindowVideojs: typeof window !== 'undefined' && !!window.videojs,
        hlsHandlerRegistered: typeof window !== 'undefined' && !!window.hlsSourceHandler,
      });
    }

    this.video = this.player.el().querySelector('video') || this.player.el();
    this.attachEvents();
  }

  attachEvents() {
    if (!this.player) return;
    const player = this.player;

    if (this._handlers) {
      this.detachEvents();
    }

    this._handlers = {
      onTimeUpdate: () => {
        const now = Date.now();
        if (now - this.lastTimeUpdateEmitMs < this.timeUpdateThrottleMs) return;
        this.lastTimeUpdateEmitMs = now;
        this.emit(PLAYER_ENGINE_EVENTS.TIME_UPDATE, {
          currentTime: player.currentTime(),
          duration: player.duration(),
        });
      },
      onDurationChange: () => {
        this.emit(PLAYER_ENGINE_EVENTS.DURATION_CHANGE, { duration: player.duration() });
      },
      onEnded: () => {
        this.emit(PLAYER_ENGINE_EVENTS.ENDED);
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.ENDED });
      },
      onPlay: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PLAYING });
      },
      onPause: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
      },
      onSeeking: () => {
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKING });
      },
      onSeeked: () => {
        this.emit(PLAYER_ENGINE_EVENTS.SEEK_END, { currentTime: player.currentTime() });
        this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.SEEKED });
      },
      onError: () => {
        if (this._suppressVjsErrors) return;
        const err = player.error();
        if (this._windDirectMode) return;
        this._log('player:error', err);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err || new Error('Error de reproducción Video.js'));
      },
      onLoadedData: () => {
        this._log('player:loadeddata');
      },
    };

    player.on('timeupdate', this._handlers.onTimeUpdate);
    player.on('durationchange', this._handlers.onDurationChange);
    player.on('ended', this._handlers.onEnded);
    player.on('play', this._handlers.onPlay);
    player.on('pause', this._handlers.onPause);
    player.on('seeking', this._handlers.onSeeking);
    player.on('seeked', this._handlers.onSeeked);
    player.on('error', this._handlers.onError);
    player.on('loadeddata', this._handlers.onLoadedData);
  }

  detachEvents() {
    if (!this.player || !this._handlers) return;
    const player = this.player;
    player.off('timeupdate', this._handlers.onTimeUpdate);
    player.off('durationchange', this._handlers.onDurationChange);
    player.off('ended', this._handlers.onEnded);
    player.off('play', this._handlers.onPlay);
    player.off('pause', this._handlers.onPause);
    player.off('seeking', this._handlers.onSeeking);
    player.off('seeked', this._handlers.onSeeked);
    player.off('error', this._handlers.onError);
    player.off('loadeddata', this._handlers.onLoadedData);
    this._handlers = null;
  }

  load(url, { type, autoPlay = false } = {}) {
    if (!this.player || !url) return;

    this._debug = this._isDebugEnabled();
    this._log('load', { url, type, autoPlay, isHls: isHlsUrl(url) });
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADING, type });

    const player = this.player;
    const useHls = isHlsUrl(url);

    if (useHls && isWindMiddlewareHost(url)) {
      this._loadWindStream(player, url, { autoPlay, type });
      return;
    }

    this._clearWindDirectMode();
    this._destroyWindModernHls();
    this._revokeWindBlob();

    const emitLoadedAndMaybePlay = () => {
      this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.LOADED, type });
      this._emitTracksChange();
      if (autoPlay) this.play();
    };

    player.one('loadeddata', emitLoadedAndMaybePlay);

    if (useHls) {
      applyStreamrootHlsSessionConfig(player, undefined, url);
      player.src({ src: url, type: 'application/x-mpegURL' });
    } else {
      player.src({ src: url });
    }
  }

  play() {
    if (!this.player) return;
    this._log('play()');
    if (this._windDirectMode) {
      const videoEl = this._getTechVideo();
      const p = videoEl?.play?.();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (err?.name === 'AbortError') return;
          this._log('play() error', err);
          this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
        });
      }
      return;
    }
    const p = this.player.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        this._log('play() error', err);
        this.emit(PLAYER_ENGINE_EVENTS.ERROR, err);
      });
    }
  }

  pause() {
    if (!this.player) return;
    this._log('pause()');
    if (this._windDirectMode) {
      this._getTechVideo()?.pause?.();
      return;
    }
    this.player.pause();
  }

  stop() {
    if (!this.player) return;
    if (this._windDirectMode) {
      const videoEl = this._getTechVideo();
      videoEl?.pause?.();
      try {
        if (videoEl) videoEl.currentTime = 0;
      } catch {
        // noop
      }
    } else {
      this.player.pause();
      try {
        this.player.currentTime(0);
      } catch {
        // noop
      }
    }
    this.emit(PLAYER_ENGINE_EVENTS.STATE_CHANGE, { state: PLAYER_ENGINE_STATES.PAUSED });
  }

  seek(seconds) {
    if (!this.player) return;
    const target = Number.isFinite(seconds) ? seconds : 0;
    this.emit(PLAYER_ENGINE_EVENTS.SEEK_START, { target });
    if (this._windDirectMode) {
      const videoEl = this._getTechVideo();
      if (videoEl) videoEl.currentTime = Math.max(0, target);
      return;
    }
    this.player.currentTime(Math.max(0, target));
  }

  forward(seconds = DEFAULT_SEEK_STEP_SECONDS) {
    if (!this.player) return;
    const step = Number.isFinite(seconds) ? seconds : DEFAULT_SEEK_STEP_SECONDS;
    const t = this._windDirectMode
      ? this._getTechVideo()?.currentTime || 0
      : this.player.currentTime() || 0;
    this.seek(t + step);
  }

  backward(seconds = DEFAULT_SEEK_STEP_SECONDS) {
    if (!this.player) return;
    const step = Number.isFinite(seconds) ? seconds : DEFAULT_SEEK_STEP_SECONDS;
    const t = this._windDirectMode
      ? this._getTechVideo()?.currentTime || 0
      : this.player.currentTime() || 0;
    this.seek(t - step);
  }

  setPlaybackRate(rate = 1) {
    if (!this.player) return;
    const normalized = Number.isFinite(rate) ? rate : 1;
    this.player.playbackRate(normalized);
  }

  setDimensions({ width, height, left, top } = {}) {
    const el = this.player?.el?.();
    if (!el) return;
    const style = el.style;
    if (Number.isFinite(width)) style.width = `${width}px`;
    if (Number.isFinite(height)) style.height = `${height}px`;
    if (Number.isFinite(left) || Number.isFinite(top)) {
      style.position = 'absolute';
      if (Number.isFinite(left)) style.left = `${left}px`;
      if (Number.isFinite(top)) style.top = `${top}px`;
    }
  }

  show() {
    const el = this.player?.el?.();
    if (!el) return;
    el.style.visibility = 'visible';
  }

  hide() {
    const el = this.player?.el?.();
    if (!el) return;
    el.style.visibility = 'hidden';
  }

  mute() {
    if (!this.player) return;
    this.player.muted(true);
  }

  unmute() {
    if (!this.player) return;
    this.player.muted(false);
  }

  destroy() {
    this._log('destroy()');
    this.detachEvents();
    this._disposePlayer();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }

  _getVjsAudioTracks() {
    try {
      const tracks = this.player?.audioTracks?.()?.tracks_;
      return Array.isArray(tracks) ? tracks : [];
    } catch {
      return [];
    }
  }

  _getVjsTextTracks() {
    try {
      const tracks = this.player?.textTracks?.()?.tracks_;
      return Array.isArray(tracks) ? tracks : [];
    } catch {
      return [];
    }
  }

  getTracks() {
    const audio = [];
    const text = [];
    let selectedAudioId = null;
    let selectedTextId = null;
    let textEnabled = false;

    this._getVjsAudioTracks().forEach((track, idx) => {
      const id = String(track?.id ?? idx);
      audio.push({
        id,
        label: track?.label || track?.language || `Audio ${idx + 1}`,
        lang: track?.language || '',
        index: idx,
      });
      if (track?.enabled) selectedAudioId = id;
    });

    this._getVjsTextTracks().forEach((track, idx) => {
      const id = String(track?.id ?? idx);
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
    const tracks = this._getVjsAudioTracks();
    let found = false;
    tracks.forEach((track, idx) => {
      const trackId = String(track?.id ?? idx);
      const enable = trackId === String(id);
      if (enable) found = true;
      track.enabled = enable;
    });
    if (found) this._emitTracksChange();
    return found;
  }

  setSubtitlesEnabled(enabled) {
    const want = enabled === true;
    const tracks = this._getVjsTextTracks();
    if (tracks.length === 0) return false;
    if (!want) {
      tracks.forEach((tr) => {
        tr.mode = 'disabled';
      });
      this._emitTracksChange();
      return true;
    }
    const showing = tracks.some((tr) => tr.mode === 'showing');
    if (!showing && tracks[0]) {
      tracks[0].mode = 'showing';
    }
    this._emitTracksChange();
    return true;
  }

  selectTextTrack(id) {
    const tracks = this._getVjsTextTracks();
    let found = false;
    tracks.forEach((track, idx) => {
      const trackId = String(track?.id ?? idx);
      const enable = trackId === String(id);
      if (enable) found = true;
      track.mode = enable ? 'showing' : 'disabled';
    });
    if (found) this._emitTracksChange();
    return found;
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
