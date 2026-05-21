import Hls from 'hls.js';
import videojs from 'video.js';

if (typeof window !== 'undefined') {
  // Plugin 10foot usa hls.js embebido si no hay global; forzamos versión moderna.
  window.Hls = Hls;
  window.videojs = videojs;
}

export { videojs, Hls };
