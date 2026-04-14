import { useState, useEffect } from 'react';

/**
 * Hook para detectar el tipo de dispositivo (TV vs PC)
 * Usa múltiples señales para mayor precisión
 */

/**
 * Detecta si el dispositivo es una TV basándose en múltiples señales
 * @returns {object} Información del dispositivo detectado
 */
export function useDeviceDetection() {
  const [deviceInfo, setDeviceInfo] = useState({
    isTV: false,
    isPC: true,
    deviceType: 'pc',
    detectionMethod: 'unknown',
    userAgent: '',
    hasPointer: true,
    hasTouch: false,
    screenWidth: 0,
    screenHeight: 0,
  });

  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const innerWidth = window.innerWidth;
      const innerHeight = window.innerHeight;

      // Señal 0 (muy fuerte): Runtime nativo expuesto (emuladores/hardware)
      // En muchos emuladores el User-Agent puede verse como Chrome/desktop,
      // pero estas APIs suelen estar presentes cuando realmente corre en webOS/Tizen.
      const hasTizenRuntime = typeof window !== 'undefined' && !!window.tizen;
      const hasSamsungWebApis = typeof window !== 'undefined' && !!window.webapis;
      const hasWebOsRuntime =
        typeof window !== 'undefined' &&
        (!!window.webOS ||
          !!window.PalmSystem ||
          (typeof window.webOS?.service?.request === 'function'));
      const hasTvRuntime = hasTizenRuntime || hasSamsungWebApis || hasWebOsRuntime;

      // Señal 1: User-Agent (TVs conocidas)
      const isTVUserAgent = 
        ua.includes('smart-tv') ||
        ua.includes('smarttv') ||
        ua.includes('tizen') || // Samsung Tizen OS
        ua.includes('webos') || // LG webOS
        ua.includes('netcast') || // LG NetCast (2016)
        ua.includes('lg') && (ua.includes('tv') || ua.includes('netcast')) ||
        ua.includes('samsung') && (ua.includes('smart-tv') || ua.includes('tizen'));

      // Señal 2: Media Query - Pointer (TV no tiene mouse)
      const hasPointer = window.matchMedia('(pointer: fine)').matches;
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasAnyPointer = hasPointer || hasCoarsePointer;
      
      // Si no tiene pointer, probablemente es TV
      const noPointer = !hasAnyPointer;

      // Señal 3: Touch (TVs modernas pueden tener touch, pero no es común)
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Señal 4: Resolución (TVs generalmente tienen resoluciones altas)
      // Pero no es determinante, PCs también pueden tener 4K
      const isHighResolution = screenWidth >= 1920 && screenHeight >= 1080;
      const isVeryHighResolution = screenWidth >= 3840; // 4K+

      // Señal 5: Aspect ratio (TVs generalmente 16:9)
      const aspectRatio = screenWidth / screenHeight;
      const isTVAspectRatio = aspectRatio >= 1.6 && aspectRatio <= 1.8; // ~16:9

      // Señal 6: Platform (algunos navegadores de TV reportan esto)
      const platform = navigator.platform?.toLowerCase() || '';
      const isTVPlatform = platform.includes('tv') || platform.includes('tizen') || platform.includes('webos');

      // Señal 7: Vendor (LG, Samsung)
      const vendor = navigator.vendor?.toLowerCase() || '';
      const isTVVendor = vendor.includes('lg') || vendor.includes('samsung');

      // Combinar señales con pesos
      let tvScore = 0;
      let detectionMethod = '';

      // Runtime nativo es la señal más fuerte (peso 4)
      if (hasTvRuntime) {
        tvScore += 4;
        detectionMethod = 'runtime';
      }

      // User-Agent es la señal más fuerte (peso 3)
      if (isTVUserAgent) {
        tvScore += 3;
        if (!detectionMethod) detectionMethod = 'user-agent';
      }

      // Sin pointer es muy indicativo de TV (peso 2)
      if (noPointer) {
        tvScore += 2;
        if (!detectionMethod) detectionMethod = 'no-pointer';
      }

      // Platform específico (peso 2)
      if (isTVPlatform) {
        tvScore += 2;
        if (!detectionMethod) detectionMethod = 'platform';
      }

      // Vendor específico (peso 1)
      if (isTVVendor && isHighResolution) {
        tvScore += 1;
        if (!detectionMethod) detectionMethod = 'vendor-resolution';
      }

      // Resolución muy alta + sin pointer (peso 1)
      if (isVeryHighResolution && noPointer) {
        tvScore += 1;
        if (!detectionMethod) detectionMethod = 'resolution-no-pointer';
      }

      // Aspect ratio TV + sin pointer (peso 1)
      if (isTVAspectRatio && noPointer && isHighResolution) {
        tvScore += 1;
        if (!detectionMethod) detectionMethod = 'aspect-ratio';
      }

      // Decisión final: Si score >= 2, es TV
      const isTV = tvScore >= 2;

      // Override manual desde URL (para testing) - máxima prioridad
      const urlParams = new URLSearchParams(window.location.search);
      const forceDevice = urlParams.get('device');
      let finalIsTV = isTV;
      let finalDeviceType = isTV ? 'tv' : 'pc';

      if (forceDevice === 'tv') {
        finalIsTV = true;
        finalDeviceType = 'tv';
        detectionMethod = 'url-override';
        // Guardar en localStorage para persistencia
        localStorage.setItem('device', 'tv');
      } else if (forceDevice === 'pc') {
        finalIsTV = false;
        finalDeviceType = 'pc';
        detectionMethod = 'url-override';
        // Guardar en localStorage para persistencia
        localStorage.setItem('device', 'pc');
      } else {
        // Si no hay override en URL, verificar localStorage
        const deviceFromStorage = localStorage.getItem('device');
        if (deviceFromStorage === 'tv' || deviceFromStorage === 'pc') {
          finalIsTV = deviceFromStorage === 'tv';
          finalDeviceType = deviceFromStorage;
          detectionMethod = 'localStorage-override';
        } else {
          // Detección automática normal
          // Guardar resultado en localStorage para referencia futura
          localStorage.setItem('device', finalDeviceType);
        }
      }

      setDeviceInfo({
        isTV: finalIsTV,
        isPC: !finalIsTV,
        deviceType: finalDeviceType,
        detectionMethod,
        userAgent: ua,
        hasPointer: hasAnyPointer,
        hasTouch,
        screenWidth,
        screenHeight,
        innerWidth,
        innerHeight,
        tvScore, // Para debugging
      });
    };

    // Detectar al montar (UNA SOLA VEZ)
    detectDevice();

    // NOTA: Se eliminaron los listeners de resize y orientationchange porque:
    // 1. El tipo de dispositivo (TV vs PC) NO cambia durante una sesión
    // 2. En TVs, los eventos resize pueden dispararse durante animaciones, causando
    //    ejecuciones innecesarias del algoritmo de detección (7 señales + scoring + localStorage)
    // 3. localStorage.setItem se ejecutaba en cada resize, bloqueando el main thread

    return () => {
      // No cleanup necesario — no hay listeners que remover
    };
  }, []);

  return deviceInfo;
}

/**
 * Hook simplificado que solo retorna si es TV
 */
export function useIsTV() {
  const { isTV } = useDeviceDetection();
  return isTV;
}

/**
 * Hook simplificado que solo retorna si es PC
 */
export function useIsPC() {
  const { isPC } = useDeviceDetection();
  return isPC;
}

