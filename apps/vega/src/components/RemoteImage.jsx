import * as React from 'react';
import {useState} from 'react';
import {Image} from 'react-native';
import {imageSource, markImageFailed} from '../remoteImage';

/**
 * <Image> remota con el filtro de remoteImage.js: no pide URLs inválidas ni
 * las que ya fallaron; si falla, la marca y muestra `fallback` (o nada).
 * Decodifica al tamaño de la vista (resizeMethod="resize").
 */
export function RemoteImage({uri, fallback = null, onError, ...props}) {
  const [failedUri, setFailedUri] = useState(null);
  const source = (uri !== failedUri && imageSource(uri)) || fallback;
  if (!source) return null;
  return (
    <Image
      resizeMethod="resize"
      {...props}
      source={source}
      onError={(e) => {
        if (source?.uri) {
          markImageFailed(source);
          setFailedUri(uri);
        }
        onError?.(e);
      }}
    />
  );
}
