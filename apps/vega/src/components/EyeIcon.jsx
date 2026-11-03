import * as React from 'react';
import {Image} from 'react-native';

// PNG de los mismos SVG que la web (_login.scss); ver assets/icons/README.md.
const OPEN = require('../../assets/icons/eye-open.png');
const CLOSED = require('../../assets/icons/eye-closed.png');

export function EyeIcon({open, size, color = '#fff'}) {
  return <Image source={open ? OPEN : CLOSED} style={{width: size, height: size, tintColor: color}} />;
}
