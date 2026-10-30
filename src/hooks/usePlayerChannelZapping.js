import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findChannelByLcn, findZappingChannelIndex } from '@appvideo/core/utils/channelZappingList';
import { getDigitFromKeyEvent, TV_ACTION } from '../utils/tvRemote';
import { createChannelNumberInput } from '@appvideo/core/utils/channelNumberInput';
import { navigationRouter } from '../navigation/NavigationRouter';

/**
 * Zapping en vivo (paridad 10foot, sin excepción fotelka en flechas).
 *
 * - CH+ / CH−: siempre con live y reproductor maximizado (como scene.js PUP/PDOWN).
 * - ↑/↓: solo si `arrowKeysEnabled` (player.channelChangeWithArrows) -- uso real: TV.
 * - ←/→: solo si `horizontalArrowKeysEnabled` (mismo flag `channelChangeWithArrows`,
 *   pero pasado en horizontal) -- uso real: PC. En PC las flechas ↑/↓ quedan
 *   libres para volumen (ver el handler de volumen registrado aparte en
 *   PlayerHud.jsx), por eso el zapping por flecha en PC usa el eje horizontal
 *   en vez del vertical que sí usa TV.
 * - channelUp / → → +1 en lista; channelDown / ← → −1 (LCN ascendente, lcn 0 al final).
 * - 0–9: número de canal (LCN). Se confirma tras CHANNEL_NUMBER_TIMEOUT_MS sin
 *   teclas o al completar las cifras del LCN más alto; `pendingChannelNumber`
 *   es lo tecleado hasta ahora, para mostrarlo en pantalla.
 *
 * Se registra como handler de zona 'global' en `NavigationRouter` en vez de
 * instalar su propio `window.addEventListener('keydown')` — antes este hook,
 * `usePlayerHudTvNavigation` y el router central competían por la misma tecla
 * con un `stopImmediatePropagation()` propio que dependía del orden de montaje
 * para "ganarle" a los demás. Ahora hay un único listener de `keydown` en toda
 * la app; este hook solo aporta un handler más a la cola de esa zona.
 */
const CHANNEL_NUMBER_TIMEOUT_MS = 2000;

export function usePlayerChannelZapping({
  arrowKeysEnabled = false,
  horizontalArrowKeysEnabled = false,
  channelKeysEnabled = true,
  digitKeysEnabled = true,
  isLiveService,
  isPlaybackMaximized,
  overlay,
  channels,
  currentServiceId,
  onZapToChannel,
  onWakeHud,
}) {
  const zapByDirection = useCallback(
    (direction) => {
      const list = Array.isArray(channels) ? channels : [];
      if (!isLiveService || !isPlaybackMaximized || list.length === 0) return;

      const idx = findZappingChannelIndex(list, currentServiceId);
      if (idx < 0) return;

      // 10foot: channelUp(+1), channelDown(-1)
      const delta = direction === 'up' ? 1 : -1;
      let nextIdx = idx + delta;
      if (nextIdx < 0) nextIdx = list.length - 1;
      if (nextIdx >= list.length) nextIdx = 0;

      const next = list[nextIdx];
      if (!next) return;
      onZapToChannel?.(next);
      onWakeHud?.();
    },
    [
      isLiveService,
      isPlaybackMaximized,
      channels,
      currentServiceId,
      onZapToChannel,
      onWakeHud,
    ],
  );

  const [pendingChannelNumber, setPendingChannelNumber] = useState('');

  // El commit llega por timer: lee siempre los canales y callbacks más recientes.
  const zapToNumberRef = useRef(null);
  const wakeHudRef = useRef(null);
  useEffect(() => {
    wakeHudRef.current = onWakeHud;
    zapToNumberRef.current = (number) => {
      if (!isLiveService || !isPlaybackMaximized) return;
      const target = findChannelByLcn(channels, number);
      if (!target) return;
      if (String(target.id) !== String(currentServiceId)) onZapToChannel?.(target);
      onWakeHud?.();
    };
  });

  const maxDigits = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    const maxLcn = list.reduce((max, ch) => Math.max(max, Number(ch?.lcn) || 0), 0);
    return String(maxLcn).length;
  }, [channels]);

  const numberInputRef = useRef(null);
  useEffect(() => {
    const input = createChannelNumberInput({
      timeoutMs: CHANNEL_NUMBER_TIMEOUT_MS,
      maxDigits,
      onChange: setPendingChannelNumber,
      onCommit: (number) => zapToNumberRef.current?.(number),
    });
    numberInputRef.current = input;
    return () => {
      input.cancel();
      if (numberInputRef.current === input) numberInputRef.current = null;
    };
  }, [maxDigits]);

  const canTypeNumber = digitKeysEnabled && isLiveService && isPlaybackMaximized && !overlay;
  useEffect(() => {
    if (!canTypeNumber) numberInputRef.current?.cancel();
  }, [canTypeNumber]);

  useEffect(() => {
    const canZap =
      isLiveService &&
      isPlaybackMaximized &&
      (arrowKeysEnabled || horizontalArrowKeysEnabled || channelKeysEnabled || digitKeysEnabled);
    if (!canZap) return undefined;

    // Handler de zona: `NavigationRouter` ya filtró altKey/ctrlKey/metaKey y
    // resolvió `action` antes de invocar esto. Retornar `true` consume la
    // tecla (el router hace preventDefault/stopPropagation por nosotros);
    // `false` la deja pasar sin necesidad de stopImmediatePropagation.
    const handler = (action, event) => {
      if (overlay) return false;

      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement
      ) {
        return false;
      }

      if (action === TV_ACTION.DIGIT) {
        const digit = getDigitFromKeyEvent(event);
        if (!digitKeysEnabled || digit == null) return false;
        numberInputRef.current?.push(digit);
        wakeHudRef.current?.();
        return true;
      }

      let direction = null;
      if (channelKeysEnabled && action === TV_ACTION.CHANNEL_UP) {
        direction = 'up';
      } else if (channelKeysEnabled && action === TV_ACTION.CHANNEL_DOWN) {
        direction = 'down';
      } else if (arrowKeysEnabled && action === TV_ACTION.UP) {
        direction = 'up';
      } else if (arrowKeysEnabled && action === TV_ACTION.DOWN) {
        direction = 'down';
      } else if (horizontalArrowKeysEnabled && action === TV_ACTION.RIGHT) {
        direction = 'up';
      } else if (horizontalArrowKeysEnabled && action === TV_ACTION.LEFT) {
        direction = 'down';
      }

      if (!direction) return false;
      numberInputRef.current?.cancel();
      zapByDirection(direction);
      return true;
    };

    return navigationRouter.register('global', handler);
  }, [
    arrowKeysEnabled,
    horizontalArrowKeysEnabled,
    channelKeysEnabled,
    digitKeysEnabled,
    isLiveService,
    isPlaybackMaximized,
    overlay,
    zapByDirection,
  ]);

  return { zapByDirection, pendingChannelNumber };
}

export default usePlayerChannelZapping;
