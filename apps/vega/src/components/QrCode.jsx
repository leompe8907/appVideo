import * as React from 'react';
import {useMemo} from 'react';
import {View} from 'react-native';
import {create as createQr} from 'qrcode/lib/core/qrcode';

/**
 * Código QR dibujado con Views (react-native-svg hace caer la app en el
 * stick). Usa el mismo generador que la web (`qrcode`), una fila por View.
 */
export function QrCode({value, size, color = '#000', background = '#fff', margin = 1}) {
  const matrix = useMemo(() => {
    try {
      const {modules} = createQr(String(value || ''), {errorCorrectionLevel: 'M'});
      const rows = [];
      for (let r = 0; r < modules.size; r += 1) {
        const row = [];
        for (let c = 0; c < modules.size; c += 1) row.push(Boolean(modules.get(r, c)));
        rows.push(row);
      }
      return rows;
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;
  const count = matrix.length + margin * 2;
  const cell = size / count;
  return (
    <View style={{width: size, height: size, backgroundColor: background, padding: cell * margin}}>
      {matrix.map((row, r) => (
        <View key={r} style={{flexDirection: 'row', height: cell}}>
          {row.map((on, c) => (
            <View key={c} style={{width: cell, height: cell, backgroundColor: on ? color : background}} />
          ))}
        </View>
      ))}
    </View>
  );
}
