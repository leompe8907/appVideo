import videojs from 'video.js';

if (typeof window !== 'undefined') {
  window.videojs = videojs;
}

export { videojs };
