export class WebEngine {
  constructor() {
    this.video = null;
    this.container = null;
    this.events = {
      timeupdate: [],
      durationchange: [],
      ended: [],
      error: [],
      statechange: [],
    };
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
      this.emit('timeupdate', {
        currentTime: v.currentTime,
        duration: v.duration,
      });
    });

    v.addEventListener('durationchange', () => {
      this.emit('durationchange', { duration: v.duration });
    });

    v.addEventListener('ended', () => {
      this.emit('ended');
      this.emit('statechange', { state: 'ended' });
    });

    v.addEventListener('play', () => {
      this.emit('statechange', { state: 'playing' });
    });

    v.addEventListener('pause', () => {
      this.emit('statechange', { state: 'paused' });
    });

    v.addEventListener('error', () => {
      this.emit('error', v.error || new Error('Unknown video error'));
    });
  }

  load(url, { type, autoPlay = false }) {
    if (!this.video || !url) return;
    const v = this.video;
    this.emit('statechange', { state: 'loading', type });

    const onCanPlay = () => {
      v.removeEventListener('canplay', onCanPlay);
      if (autoPlay) this.play();
    };
    if (autoPlay) {
      v.addEventListener('canplay', onCanPlay, { once: true });
    }

    v.src = url;
    v.load();
    this.emit('statechange', { state: 'loaded', type });
  }

  play() {
    if (!this.video) return;
    this.video
      .play()
      .catch((err) => {
        this.emit('error', err);
      });
  }

  pause() {
    if (!this.video) return;
    this.video.pause();
  }

  seek(seconds) {
    if (!this.video) return;
    const target = Number.isFinite(seconds) ? seconds : 0;
    this.video.currentTime = Math.max(0, target);
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

  on(event, cb) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
  }

  off(event, cb) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((fn) => fn !== cb);
  }

  emit(event, payload) {
    if (!this.events[event]) return;
    this.events[event].forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[WebEngine] Error en handler', event, e);
      }
    });
  }
}

