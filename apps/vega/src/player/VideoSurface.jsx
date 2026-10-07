import * as React from 'react';
import {useCallback} from 'react';
import {StyleSheet} from 'react-native';
import {KeplerCaptionsView, KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';

/**
 * Superficie de video y subtítulos, memorizada y con callbacks estables:
 * no se re-renderiza con el HUD (antes recibía funciones nuevas en cada
 * render del reproductor).
 * `handlesRef.current` = {surface, caption}; `playerRef.current` = VegaHlsPlayer.
 */
export const VideoSurface = React.memo(function VideoSurface({handlesRef, playerRef, showCaptions}) {
  const onSurfaceViewCreated = useCallback(
    (h) => {
      handlesRef.current.surface = h;
      playerRef.current?.setSurfaceHandle(h);
    },
    [handlesRef, playerRef],
  );
  const onSurfaceViewDestroyed = useCallback(
    (h) => {
      playerRef.current?.clearSurfaceHandle(h);
      handlesRef.current.surface = null;
    },
    [handlesRef, playerRef],
  );
  const onCaptionViewCreated = useCallback(
    (h) => {
      handlesRef.current.caption = h;
      playerRef.current?.setCaptionViewHandle(h);
    },
    [handlesRef, playerRef],
  );
  return (
    <>
      <KeplerVideoSurfaceView style={styles.surface} onSurfaceViewCreated={onSurfaceViewCreated} onSurfaceViewDestroyed={onSurfaceViewDestroyed} />
      <KeplerCaptionsView onCaptionViewCreated={onCaptionViewCreated} show={showCaptions} style={styles.captions} />
    </>
  );
});

const styles = StyleSheet.create({
  surface: {zIndex: 0},
  captions: {position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1},
});
