import * as React from 'react';
import {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {formatTime} from '../epg';

/** Hora actual (HH:MM) que se actualiza sola al cambiar el minuto. */
export function Clock({style}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 60000 - (Date.now() % 60000) + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return <Text style={style}>{formatTime(now)}</Text>;
}
