import * as React from 'react';
import {StyleSheet, View} from 'react-native';
import LinearGradient from '@amazon-devices/react-linear-gradient';
import {parseLinearGradient} from '../theme';

/**
 * Fondo a partir de un valor CSS de la marca: color sólido o
 * `linear-gradient(...)` (p. ej. `login.theme.submitBg`). Ocupa todo el padre.
 */
export function CssBackground({value, radius = 0}) {
  const gradient = parseLinearGradient(value);
  if (!gradient) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: value, borderRadius: radius}]} />;
  }
  return (
    <LinearGradient
      pointerEvents="none"
      colors={gradient.stops.map((s) => s.color)}
      locations={gradient.stops.map((s) => s.offset)}
      useAngle
      angle={gradient.angle}
      style={[StyleSheet.absoluteFill, {borderRadius: radius}]}
    />
  );
}
