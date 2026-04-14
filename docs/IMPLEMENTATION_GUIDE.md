# Implementation Guide - Performance Optimizations

**Companion to:** `TECHNICAL_AUDIT.md`  
**Date:** April 13, 2026

---

## Phase 1: Critical Fixes (Immediate)

### Fix 1: Enable Code Splitting

**File:** `vite.config.js`

#### Current State:
```js
build: {
  rollupOptions: {
    output: {
      inlineDynamicImports: true, // ❌ Merges ALL chunks into one
    },
  },
},
```

#### New Configuration:
```js
build: {
  outDir: brand ? `dist/${brand}` : 'dist',
  target: 'es2017', // ← Changed from es2015
  cssTarget: 'chrome61',
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: !isDev,
      drop_debugger: true,
    },
  },
  rollupOptions: {
    output: {
      // ✅ Enable code splitting with manual chunk allocation
      manualChunks(id) {
        // Vendor chunks
        if (id.includes('node_modules')) {
          if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router')) {
            return 'vendor-react';
          }
          if (id.includes('hls.js')) {
            return 'vendor-hls';
          }
          if (id.includes('norigin-spatial-navigation')) {
            return 'vendor-nav';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          if (id.includes('zustand')) {
            return 'vendor-state';
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'vendor-i18n';
          }
        }
        
        // Page chunks (automatic via lazy loading)
        if (id.includes('/src/pages/')) {
          const page = id.split('/').pop().replace('.jsx', '');
          return `page-${page}`;
        }
        
        // Player engines
        if (id.includes('/src/player/')) {
          return 'player-engine';
        }
      },
    },
  },
},
```

#### Verification:
```bash
pnpm run build:intv
# Check dist/intv/assets/ — should see multiple .js files, not one giant bundle
```

---

### Fix 2: Remove Duplicate PreloadContext

**Files to modify:**
- ❌ DELETE: `src/contexts/PreloadContext.jsx`
- ✅ UPDATE: `src/store/usePreload.js` (already correct)
- 🔍 AUDIT: All imports of `usePreload`

#### Step 1: Verify Zustand wrapper is correct

**File:** `src/store/usePreload.js` (already exists, verify it's like this):
```js
import { usePreloadStore } from './preloadStore';

/**
 * Hook de compatibilidad: expone la misma API que el contexto original
 */
export function usePreload() {
  const epg = usePreloadStore((s) => s.epg);
  const vod = usePreloadStore((s) => s.vod);
  const ads = usePreloadStore((s) => s.ads);
  const catchup = usePreloadStore((s) => s.catchup);

  const loadEPG = usePreloadStore((s) => s.loadEPG);
  const loadVOD = usePreloadStore((s) => s.loadVOD);
  const loadAds = usePreloadStore((s) => s.loadAds);
  const loadCatchup = usePreloadStore((s) => s.loadCatchup);
  const resetPreload = usePreloadStore((s) => s.resetPreload);
  const getStreamsWithEPG = usePreloadStore((s) => s.getStreamsWithEPG);

  return {
    epg,
    vod,
    ads,
    catchup,
    loadEPG,
    loadVOD,
    loadAds,
    loadCatchup,
    resetPreload,
    getStreamsWithEPG,
  };
}

export default usePreload;
```

#### Step 2: Find all imports of PreloadContext

```bash
# Search for any remaining Context imports
grep -r "PreloadContext" src/
grep -r "preloadContext" src/
```

#### Step 3: Update any remaining Context imports

If any file imports from `contexts/PreloadContext`, change to:
```js
// ❌ OLD
import { usePreload } from '../contexts/PreloadContext';

// ✅ NEW
import { usePreload } from '../store/usePreload';
```

#### Step 4: Delete PreloadContext.jsx

```bash
rm src/contexts/PreloadContext.jsx
```

#### Step 5: Verify no Provider needed

Zustand stores are **providerless** — they work without wrapping in context providers. Verify `main.jsx` does NOT include `PreloadProvider`.

---

### Fix 3: Fix PlayerContext Engine Recreation

**File:** `src/contexts/PlayerContext.jsx`

#### Problem Section (line ~100):
```js
const engineSignature = [
  deviceInfo?.isTV ? 'tv' : 'pc',
  String(deviceInfo?.userAgent || ''), // ❌ This changes unnecessarily
  String(currentBrand?.brand || ''),
  String(currentBrand?.player?.nativeAdaptersEnabled === true),
  String(currentBrand?.player?.enginePolicy || 'auto'),
].join('::');

useEffect(() => {
  const engine = createEngine(deviceInfo);
  engineRef.current = engine;
  // ... 200 lines of event handlers
  
  return () => {
    engine.destroy();
    engineRef.current = null;
  };
}, [engineSignature]); // ❌ Recreates engine on signature change
```

#### Solution:

**Step 1:** Remove `userAgent` from signature:
```js
const engineSignature = [
  deviceInfo?.isTV ? 'tv' : 'pc',
  String(currentBrand?.brand || ''),
  String(currentBrand?.player?.nativeAdaptersEnabled === true),
  String(currentBrand?.player?.enginePolicy || 'auto'),
].join('::');
```

**Step 2:** Change effect to create engine only once:
```js
// Inicializar engine UNA SOLA VEZ (no recrear en cambios de marca/dispositivo)
useEffect(() => {
  debugRef.current = isDebugEnabled();
  
  // Solo crear si no existe
  if (engineRef.current) {
    console.warn('[PlayerContext] Engine already exists, skipping creation');
    return;
  }
  
  const engine = createEngine(deviceInfo);
  engineRef.current = engine;
  log('engine:create', { deviceType: deviceInfo?.deviceType, isTV: !!deviceInfo?.isTV });

  if (containerRef.current) {
    engine.init(containerRef.current);
    log('engine:init', { hasContainer: true });
  }

  // ... all event handlers (keep as-is)
  
  engine.on(PLAYER_ENGINE_EVENTS.TIME_UPDATE, handleTime);
  // ... (all other .on calls)

  return () => {
    // Solo limpiar en desmount del provider, no en cambios de dependencias
    // engine.destroy() se llama cuando PlayerProvider se desmonta
  };
}, []); // ← Empty dependency array = run once on mount
```

**Step 3:** Add cleanup on provider unmount:
```js
// Add a separate effect for cleanup on unmount
useEffect(() => {
  return () => {
    // This runs when PlayerProvider is removed from tree
    clearSeekTimeout();
    log('engine:destroy (cleanup)');
    engineRef.current?.destroy();
    engineRef.current = null;
  };
}, []);
```

**Step 4:** Add engine recreation when platform actually changes:
```js
// Detectar cambio real de plataforma y recrear engine solo cuando sea necesario
const prevPlatformRef = useRef(null);

useEffect(() => {
  const currentPlatform = deviceInfo?.isTV ? 'tv' : 'pc';
  
  if (prevPlatformRef.current && prevPlatformRef.current !== currentPlatform) {
    // Plataforma cambió — destruir y recrear
    log('engine:platformChanged', { from: prevPlatformRef.current, to: currentPlatform });
    engineRef.current?.destroy();
    engineRef.current = null;
    
    const newEngine = createEngine(deviceInfo);
    engineRef.current = newEngine;
    if (containerRef.current) {
      newEngine.init(containerRef.current);
    }
    // Re-register event handlers...
  }
  
  prevPlatformRef.current = currentPlatform;
}, [deviceInfo?.isTV]); // Only watch isTV, not full object
```

---

### Fix 4: Debounce Device Detection

**File:** `src/hooks/useDeviceDetection.js`

#### Current (lines ~180-185):
```js
// Detectar al montar
detectDevice();

// Re-detectar si cambia el tamaño (por si acaso)
window.addEventListener('resize', detectDevice); // ❌ Wasteful
window.addEventListener('orientationchange', detectDevice);

return () => {
  window.removeEventListener('resize', detectDevice);
  window.removeEventListener('orientationchange', detectDevice);
};
```

#### New:
```js
useEffect(() => {
  const detectDevice = () => {
    // ... existing detection logic (keep as-is)
  };

  // Detectar UNA SOLA VEZ al montar
  detectDevice();

  // NO re-ejecutar en resize — la detección de TV no cambia en runtime
  // Los eventos de resize en TVs pueden dispararse durante animaciones

  return () => {
    // No cleanup needed — no event listeners added
  };
}, []); // Empty deps = run once
```

**Rationale:** Device type (TV vs PC) doesn't change during a session. If a user resizes a browser window on PC, they're still on PC. If on TV, resize events don't change device type.

---

### Fix 5: Change Build Target

**File:** `vite.config.js`

```js
build: {
  target: 'es2017', // ← Changed from 'es2015'
  cssTarget: 'chrome61',
  // ... rest
},
```

**Why ES2017?**
- 2019 TVs (LG webOS 4 = Chrome 68, Tizen 5 = Chrome 69) support ES2017 natively
- ES2017 includes: `async/await`, object spread, `Object.values/entries`
- Reduces transpilation overhead
- Smaller bundle size

---

## Phase 2: Performance Optimizations

### Fix 6: Split PlayerHud Component

**File:** `src/components/player/PlayerHud.jsx` (1,027 lines)

#### Step 1: Extract sub-components

Create these files:

**`src/components/player/ChannelSidebar.jsx`**
```jsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

function ChannelSidebar({ open, title, children, onClose }) {
  const { t } = useTranslation();
  
  if (!open) return null;
  
  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <h3>{title}</h3>
        <button onClick={onClose}>{t('common.close')}</button>
      </div>
      {children}
    </div>
  );
}

export default ChannelSidebar;
```

**`src/components/player/SeekControls.jsx`**
```jsx
import { useCallback } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { FocusableButton } from '../navigation/FocusableButton';

function SeekControls({ isTV }) {
  const { seek, forward, backward } = usePlayer();
  
  const handleRewind = useCallback(() => backward(10), [backward]);
  const handleForward = useCallback(() => forward(10), [forward]);
  
  if (!isTV) return null;
  
  return (
    <div className="seek-controls">
      <FocusableButton focusKey="seek-backward" onClick={handleRewind}>
        -10s
      </FocusableButton>
      <FocusableButton focusKey="seek-forward" onClick={handleForward}>
        +10s
      </FocusableButton>
    </div>
  );
}

export default SeekControls;
```

**`src/components/player/VolumeControls.jsx`**
```jsx
import { useCallback } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';

function VolumeControls() {
  const { mute, unmute } = usePlayer();
  
  const toggleMute = useCallback(() => {
    // Check current state and toggle
  }, [mute, unmute]);
  
  return (
    <div className="volume-controls">
      <button onClick={toggleMute}>Mute</button>
    </div>
  );
}

export default VolumeControls;
```

#### Step 2: Simplify PlayerHud.jsx

```jsx
import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import { useDevice } from '../../contexts/DeviceContext';
import ChannelSidebar from './ChannelSidebar';
import SeekControls from './SeekControls';
import VolumeControls from './VolumeControls';

const PlayerHud = React.memo(function PlayerHud() {
  const { state, tracks } = usePlayer();
  const { isTV } = useDevice();
  const [showControls, setShowControls] = useState(false);
  
  // Simplified main component — delegate to sub-components
  return (
    <div className="player-hud">
      <ChannelSidebar 
        open={showControls} 
        onClose={() => setShowControls(false)}
      >
        {/* channel list */}
      </ChannelSidebar>
      
      <div className="player-hud-bottom">
        <SeekControls isTV={isTV} />
        <VolumeControls />
        {/* progress bar, etc. */}
      </div>
    </div>
  );
});

export default PlayerHud;
```

---

### Fix 7: Virtualize EPG List

**File:** `src/components/epg/EpgCards.jsx`

#### Step 1: Install react-virtuoso

```bash
pnpm add @tanstack/react-virtual
```

#### Step 2: Implement virtualization

```jsx
import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

function EpgCards({ channels, brandConfig }) {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // height per channel row
    overscan: 5, // render 5 extra rows above/below visible area
  });
  
  return (
    <div 
      ref={parentRef} 
      className="epg-container"
      style={{ overflow: 'auto', height: '100%' }}
    >
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const channel = channels[virtualRow.index];
          
          return (
            <div
              key={channel.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <EpgChannelCard channel={channel} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EpgCards;
```

**Impact:** Instead of rendering 500+ channel rows, renders only ~15 visible + 10 overscan = 25 DOM nodes.

---

### Fix 8: Debounce Search

**File:** `src/pages/SearchPage.jsx`

#### Add custom hook:

**`src/hooks/useDebouncedValue.js`**
```js
import { useState, useEffect } from 'react';

export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  
  return debounced;
}
```

#### Use in SearchPage:

```jsx
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  // Use debouncedSearch for API calls/filtering
  useEffect(() => {
    if (!debouncedSearch) return;
    // Perform search with debouncedSearch
  }, [debouncedSearch]);
  
  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      // ...
    />
  );
}
```

---

### Fix 9: Migrate PlayerContext to Zustand

This is a larger migration. Here's the approach:

#### Step 1: Create store

**`src/store/playerStore.js`**
```js
import { create } from 'zustand';
import { createEngine } from '../player/engines/createEngine';
import { PLAYER_ENGINE_EVENTS } from '../player/engines/contracts';

export const usePlayerStore = create((set, get) => {
  let engineRef = { current: null };
  let containerRef = { current: null };
  
  return {
    // State
    playback: {
      type: null,
      id: null,
      url: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      error: null,
    },
    tracks: {
      audio: [],
      text: [],
      selectedAudioId: null,
      selectedTextId: null,
      textEnabled: false,
    },
    
    // Actions
    initializeEngine: (deviceInfo) => {
      if (engineRef.current) return;
      
      const engine = createEngine(deviceInfo);
      engineRef.current = engine;
      
      if (containerRef.current) {
        engine.init(containerRef.current);
      }
      
      // Set up event listeners
      engine.on(PLAYER_ENGINE_EVENTS.TIME_UPDATE, ({ currentTime, duration }) => {
        set((state) => ({
          playback: { ...state.playback, currentTime, duration },
        }));
      });
      
      // ... other events
    },
    
    play: ({ type, id, url, item }) => {
      const engine = engineRef.current;
      if (!engine || !url) return;
      
      set((state) => ({
        playback: { ...state.playback, type, id, url, item, isPlaying: true, isLoading: true },
      }));
      
      engine.load(url, { type, autoPlay: true });
    },
    
    pause: () => {
      engineRef.current?.pause();
      set((state) => ({
        playback: { ...state.playback, isPlaying: false },
      }));
    },
    
    stop: () => {
      engineRef.current?.stop();
      set((state) => ({
        playback: { ...state.playback, isPlaying: false, currentTime: 0 },
      }));
    },
    
    setContainerRef: (ref) => {
      containerRef.current = ref;
    },
  };
});
```

#### Step 2: Create compatibility hook

**`src/hooks/usePlayer.js`**
```js
import { usePlayerStore } from '../store/playerStore';

export function usePlayer() {
  const playback = usePlayerStore((s) => s.playback);
  const tracks = usePlayerStore((s) => s.tracks);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const stop = usePlayerStore((s) => s.stop);
  const setContainerRef = usePlayerStore((s) => s.setContainerRef);
  
  return {
    state: playback,
    tracks,
    play,
    pause,
    stop,
    containerRef: { current: null }, // Need to adapt
    // ... map all other methods
  };
}
```

**Note:** This migration is complex because PlayerContext holds engine refs and DOM refs. Test thoroughly on actual TVs before deploying.

---

## Phase 3: Polish & Monitoring

### Fix 10: Add Bundle Analyzer

**`package.json`**
```json
{
  "scripts": {
    "analyze": "npx vite-bundle-visualizer",
    "analyze:intv": "pnpm run build:intv && npx vite-bundle-visualizer --dir dist/intv"
  }
}
```

```bash
pnpm add -D vite-bundle-visualizer
pnpm run analyze:intv
```

### Fix 11: Add Performance Budget

**`package.json`**
```json
{
  "scripts": {
    "check-size": "node scripts/checkBundleSize.js"
  }
}
```

**`scripts/checkBundleSize.js`**
```js
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const MAX_BUNDLE_SIZE_KB = 500; // 500KB limit per chunk
const brand = process.env.VITE_BRAND || 'intv';
const distDir = `dist/${brand}/assets`;

const files = readdirSync(distDir);
const jsFiles = files.filter(f => f.endsWith('.js'));

let totalSize = 0;
let oversized = [];

jsFiles.forEach(file => {
  const size = statSync(join(distDir, file)).size / 1024;
  totalSize += size;
  
  if (size > MAX_BUNDLE_SIZE_KB) {
    oversized.push({ file, size: Math.round(size) });
  }
});

console.log(`Total JS bundle size: ${Math.round(totalSize)} KB`);

if (oversized.length > 0) {
  console.error('\n❌ Oversized chunks:');
  oversized.forEach(({ file, size }) => {
    console.error(`  ${file}: ${size} KB (limit: ${MAX_BUNDLE_SIZE_KB} KB)`);
  });
  process.exit(1);
} else {
  console.log('✅ All chunks within size limit');
}
```

---

## Testing Checklist

After each fix:

- [ ] Build succeeds: `pnpm run build:intv`
- [ ] Dev server works: `pnpm run dev`
- [ ] No console errors in browser
- [ ] TV emulator loads successfully (Tizen 5 / webOS 4)
- [ ] Player plays content (if emulator available)
- [ ] Navigation works with keyboard (simulate remote)
- [ ] Bundle size decreased (check with `ls -la dist/*/assets/`)

### Performance Metrics to Track

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Initial load time | Browser DevTools Network tab | <2s on PC, <3s on TV |
| Bundle size | `ls dist/*/assets/*.js` | <500KB initial |
| Time to interactive | Lighthouse or manual | <3s |
| Memory usage | Chrome DevTools Memory tab | <200MB |
| Re-renders/sec | React DevTools Profiler | <10/sec idle, <60 during playback |

---

## Rollback Plan

If any fix causes issues on target TVs:

1. **Code splitting:** Revert to `inlineDynamicImports: true` temporarily
2. **PreloadContext removal:** Restore from git: `git checkout HEAD -- src/contexts/PreloadContext.jsx`
3. **PlayerContext changes:** Revert engine recreation logic
4. **Build target:** Change back to `es2015`

Always test on actual hardware before deploying to production.

---

*End of implementation guide.*
