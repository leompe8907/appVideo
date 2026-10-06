import * as React from 'react';
import {useState} from 'react';
import {Pressable, Text} from 'react-native';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

/** Botón para control remoto: borde blanco y fondo más claro con foco. */
export function FocusButton({label, onPress, hasTVPreferredFocus, style, primary, disabled}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityRole="button"
      style={[
        styles.button,
        {backgroundColor: primary ? theme.secondary : theme.surface},
        focused && {borderColor: theme.focusBorder, transform: [{scale: 1.05}]},
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.label, {color: theme.text}]}>{label}</Text>
    </Pressable>
  );
}

const styles = createScaledStyles({
  button: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  label: {fontSize: 26, fontWeight: '600'},
  disabled: {opacity: 0.5},
});
