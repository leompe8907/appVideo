import * as React from 'react';
import {View} from 'react-native';
import {getTheme} from '../theme';
import {px} from '../scaledStyles';

/**
 * Anillo de foco de la TV (equivalente a TvFocusRing de la web, spec §6.3):
 * borde de 3px en el color de foco de la marca, 4px por fuera del elemento,
 * con el mismo radio. Sin escala. Se pone como último hijo de un contenedor
 * con `position: relative` (el default en RN).
 */
export function FocusRing({visible, radius = 10, scale = 1}) {
  if (!visible) return null;
  const theme = getTheme();
  const inset = px(4);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -inset,
        left: -inset,
        right: -inset,
        bottom: -inset,
        borderWidth: Math.max(2, px(3)),
        borderColor: theme.focusColor,
        borderRadius: px(radius, scale) + inset,
        shadowColor: theme.focusColor,
        shadowOpacity: 0.45,
        shadowRadius: px(18),
        shadowOffset: {width: 0, height: 0},
      }}
    />
  );
}
