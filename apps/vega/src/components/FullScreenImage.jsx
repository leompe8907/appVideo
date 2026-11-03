import * as React from 'react';
import {Dimensions, Image} from 'react-native';

/**
 * Imagen a pantalla completa (`cover`). En Vega una Image con
 * `StyleSheet.absoluteFill` se dibuja a su tamaño en píxeles (ampliada):
 * hay que darle ancho y alto explícitos.
 */
export function FullScreenImage({source, blurRadius}) {
  const {width, height} = Dimensions.get('window');
  return (
    <Image
      source={source}
      resizeMode="cover"
      blurRadius={blurRadius}
      style={{position: 'absolute', top: 0, left: 0, width, height}}
    />
  );
}
