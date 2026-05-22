import Hls from 'hls.js';
import videojs from 'video.js';

if (typeof window !== 'undefined') {
  window.Hls = Hls;
  window.videojs = videojs;
}

export { videojs, Hls };
