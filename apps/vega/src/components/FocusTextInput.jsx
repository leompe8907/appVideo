import * as React from 'react';
import {useState} from 'react';
import {TextInput} from 'react-native';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';

/** Campo de texto para control remoto (teclado del sistema con OK): borde de acento con foco. */
export function FocusTextInput({style, ...props}) {
  const theme = getTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor="rgba(255,255,255,0.4)"
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused && {borderColor: theme.focusColor}, props.editable === false && styles.disabled, style]}
    />
  );
}

const styles = createScaledStyles({
  input: {
    minHeight: 64,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 26,
  },
  disabled: {opacity: 0.5},
});
