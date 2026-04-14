# OTT Smart TV Development Guidelines

**Project:** Multi-brand OTT App (LG webOS / Samsung Tizen 2019)  
**Stack:** React 18 + Vite 7 + Zustand + TanStack Query  
**Last Updated:** April 13, 2026

---

## 1. Quick Reference

### Do's ✅

```jsx
// ✅ Memoize components that receive frequent updates
const ChannelCard = React.memo(function ChannelCard({ channel, onSelect }) {
  // ...
});

// ✅ Use stable callbacks
const handleSelect = useCallback((id) => onSelect(id), [onSelect]);

// ✅ Memoize expensive computations
const filteredChannels = useMemo(
  () => channels.filter(ch => ch.visible),
  [channels]
);

// ✅ Use Zustand selectors for large state
const epgStatus = usePreloadStore((s) => s.epg.status); // Only re-renders when status changes

// ✅ Lazy load pages (already done)
const VodPage = lazy(() => import('./pages/VodPage'));

// ✅ Debounce user input
const debouncedSearch = useDebouncedValue(searchTerm, 300);

// ✅ Throttle time-based updates
const handleTimeUpdate = throttle((time) => setState(time), 1000);
```

### Don'ts ❌

```jsx
// ❌ Inline functions in render (causes re-renders)
<Button onClick={() => handleSelect(channel.id)} />

// ❌ Creating objects in render
const style = { color: focused ? 'blue' : 'white' }; // New object every render

// ❌ Unnecessary useEffect dependencies
useEffect(() => {
  // This runs every time `state` changes (even unrelated properties)
}, [state]);

// ❌ Writing to localStorage in hot paths
useEffect(() => {
  localStorage.setItem('currentTime', state.currentTime); // Called 4x per second!
}, [state.currentTime]);

// ❌ Rendering large lists without virtualization
{channels.map(ch => <ChannelCard key={ch.id} channel={ch} />)} // 500+ DOM nodes

// ❌ Console.log in production
console.log('playing:', url); // Stays in bundle unless plain console.log()
```

---

## 2. State Management Decision Tree

```
Is this data...
│
├── Server-fetched (API call)?
│   └── YES → Use TanStack Query (useQuery, useMutation)
│
├── Global and rarely changes (< 5x/session)?
│   └── YES → Use React Context (Brand, Device)
│
├── Global and changes frequently?
│   └── YES → Use Zustand (Player state, UI state)
│
├── Large dataset (>100 items)?
│   └── YES → Use Zustand with selectors (EPG, VOD catalog)
│
├── Local to one component?
│   └── YES → Use useState
│
└── Shared across unrelated components?
    └── YES → Use Zustand
```

---

## 3. Component Structure Template

```jsx
import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpatialNavigation } from '../../hooks/navigation/useSpatialNavigation';

/**
 * ComponentName - Brief description
 * 
 * @param {Type} propName - Description
 * @returns {JSX.Element}
 */
const ComponentName = React.memo(function ComponentName({ propName, onAction }) {
  const { t } = useTranslation();
  
  // 1. State (useState)
  const [isOpen, setIsOpen] = useState(false);
  
  // 2. Context/Store hooks
  const { currentBrand } = useBrand();
  const someData = useSomeStore((s) => s.specificField); // Granular selector
  
  // 3. Memoized values
  const computedValue = useMemo(() => {
    return expensiveOperation(someData);
  }, [someData]);
  
  // 4. Stable callbacks
  const handleClick = useCallback(() => {
    onAction(propName);
  }, [propName, onAction]);
  
  // 5. Spatial navigation (TV only)
  const { ref, focused } = useSpatialNavigation({
    focusKey: 'component-name',
    onEnterPress: handleClick,
  });
  
  // 6. Effects (side effects, subscriptions)
  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, []);
  
  // 7. Render
  return (
    <div ref={ref} className={focused ? 'focused' : ''}>
      {/* JSX */}
    </div>
  );
});

export default ComponentName;
```

---

## 4. TV-Specific Rules

### 4.1 Focus Management

```jsx
// ✅ Every interactive element must be focusable
<FocusableButton focusKey="my-button" onClick={handleClick}>
  Click Me
</FocusableButton>

// ✅ Set initial focus after mount
useEffect(() => {
  if (isTV) {
    const timer = setTimeout(() => {
      focusSelf(); // From useSpatialNavigation
    }, 100);
    return () => clearTimeout(timer);
  }
}, [isTV, focusSelf]);

// ❌ Don't use tabIndex manually — let spatial navigation handle it
<div tabIndex={0} onClick={...}> {/* BAD */}
```

### 4.2 Remote Control Key Handling

```jsx
// ✅ Use spatial navigation key mapping
const { ref } = useSpatialNavigation({
  onEnterPress: handleSelect,
  onArrowPress: (direction) => handleNavigation(direction),
});

// ✅ For global key handling (back button, etc.)
useEffect(() => {
  if (!isTV) return;
  
  const handleKeyDown = (e) => {
    if (e.key === 'Back' || e.key === 'Exit') {
      navigate(-1);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isTV, navigate]);
```

### 4.3 Performance Budget

| Resource | Limit | Notes |
|----------|-------|-------|
| Initial bundle | <500 KB | Main chunk only |
| Total JS parsed | <2 MB | All chunks combined |
| DOM nodes | <5,000 | At any time |
| Memory heap | <200 MB | JavaScript heap |
| Re-renders/sec | <10 | When idle |
| Animation frame | 60 FPS | Navigation transitions |

### 4.4 Memory Management

```jsx
// ✅ Clean up subscriptions in useEffect return
useEffect(() => {
  const subscription = someService.subscribe(handler);
  return () => subscription.unsubscribe();
}, []);

// ✅ Clean up timers
useEffect(() => {
  const timer = setTimeout(() => doSomething(), 1000);
  return () => clearTimeout(timer);
}, []);

// ✅ Use weak maps for caches that shouldn't prevent GC
const elementCache = new WeakMap();

// ❌ Don't hold references to unmounted components
const badCache = new Map(); // Strong references prevent GC
```

---

## 5. Build & Deploy

### 5.1 Commands

```bash
# Development
pnpm dev                          # Dev server (all brands)
VITE_BRAND=intv pnpm dev          # Dev with specific brand

# Build
pnpm run build:intv               # Build intv brand
pnpm run build:all                # Build all brands
pnpm run build:all -- --mode production  # Production build

# Preview
pnpm run preview:intv             # Preview built bundle

# Analyze
pnpm run analyze:intv             # Bundle visualization

# Quality
pnpm run lint                     # ESLint
```

### 5.2 Brand Configuration

```bash
# Build specific brand
VITE_BRAND=bromteck VITE_DEFAULT_BRAND=bromteck pnpm run build

# Available brands
bromteck, intv, gigmax, cableatlantico
```

### 5.3 Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_BRAND` | Active brand for build | `intv` |
| `VITE_DEFAULT_BRAND` | Fallback brand | `bromteck` |
| `VITE_SPATIAL_NAV_DEBUG` | Enable nav debug | `true` |
| `VITE_SPATIAL_NAV_VISUAL_DEBUG` | Visual debug overlay | `true` |

---

## 6. Testing on TVs

### 6.1 Emulators

**Samsung Tizen:**
```bash
# Install Tizen Studio
# https://developer.samsung.com/tizen-studio

# Run emulator
tizen emulator -l  # List emulators
tizen run -p <project-path> -e <emulator-name>
```

**LG webOS:**
```bash
# Install webOS SDK
# https://webostv.developer.lge.com/develop/tools/webos-emulator/

# Run emulator
# Launch from webOS TV Simulator app
```

### 6.2 Physical Device Testing

**Always test on actual hardware before production deployment:**

1. Build for specific brand
2. Deploy to TV via USB or network
3. Test:
   - Initial load time
   - Navigation fluency
   - Player playback
   - Focus behavior with remote
   - Memory after 30 min usage

---

## 7. Code Review Checklist

Before merging any PR:

### Functionality
- [ ] Feature works as expected
- [ ] Error cases handled
- [ ] Loading states implemented

### Performance
- [ ] No unnecessary re-renders
- [ ] Large lists virtualized
- [ ] Expensive operations memoized
- [ ] No console.log in production code

### TV Compatibility
- [ ] Focus works with remote control
- [ ] All interactive elements focusable
- [ ] No keyboard-only interactions
- [ ] Touch targets adequate (48x48px minimum)

### Code Quality
- [ ] Components under 300 lines
- [ ] Proper TypeScript types (if using TS)
- [ ] Effects have cleanup functions
- [ ] No memory leaks
- [ ] ESLint passes

### Bundle Impact
- [ ] New dependencies justified
- [ ] Bundle size impact measured
- [ ] No duplicate libraries

---

## 8. Common Patterns

### 8.1 Fetching Data

```jsx
// Server data → TanStack Query
function VodPage() {
  const { data: vodData, isLoading } = useQuery({
    queryKey: ['vod'],
    queryFn: () => vodService.getVodData(),
    staleTime: 60_000,
  });
  
  if (isLoading) return <Loading />;
  return <VodContent data={vodData} />;
}

// Client-side state → Zustand
function SomeComponent() {
  const someValue = useSomeStore((s) => s.specificField);
  const updateValue = useSomeStore((s) => s.updateValue);
  
  // ...
}
```

### 8.2 Spatial Navigation Pattern

```jsx
function FocusableList({ items, onSelect }) {
  return (
    <div className="focusable-list">
      {items.map((item, index) => (
        <FocusableCard
          key={item.id}
          focusKey={`item-${item.id}`}
          onEnterPress={() => onSelect(item)}
        >
          <ItemContent item={item} />
        </FocusableCard>
      ))}
    </div>
  );
}
```

### 8.3 Conditional TV/PC Behavior

```jsx
function SomeComponent() {
  const { isTV } = useDevice();
  
  return (
    <div>
      {isTV ? (
        <FocusableButton onClick={handleClick}>TV Button</FocusableButton>
      ) : (
        <button onClick={handleClick}>PC Button</button>
      )}
    </div>
  );
}
```

---

## 9. Troubleshooting

### Issue: Black screen during playback

**Possible causes:**
1. Engine recreated during playback (Fix #3 in IMPLEMENTATION_GUIDE.md)
2. Video element unmounted by React reconciliation
3. DRM license expired

**Debug:**
```js
// Check if engine exists
console.log('[Player] Engine exists:', !!engineRef.current);
console.log('[Player] Container:', containerRef.current);

// Check video element
const video = containerRef.current?.querySelector('video');
console.log('[Player] Video element:', video);
console.log('[Player] Video src:', video?.src);
```

### Issue: Focus not working

**Possible causes:**
1. Spatial navigation not initialized
2. Component missing `focusKey`
3. Focusable prop set to false

**Debug:**
```jsx
// Enable spatial navigation debug
// In SpatialNavigationProvider:
initNav({
  debug: true,
  visualDebug: true, // Shows focusable elements with colored borders
});

// Check if component is focusable
const { focused, focusSelf } = useSpatialNavigation({
  focusKey: 'test',
  onFocus: () => console.log('FOCUSED'),
  onBlur: () => console.log('BLURRED'),
});
```

### Issue: Slow navigation on TV

**Possible causes:**
1. Too many DOM nodes rendered
2. Unnecessary re-renders
3. Large bundle parse time

**Debug:**
1. Open React DevTools Profiler
2. Record interaction
3. Check "Why did this render?"
4. Look for components rendering unnecessarily

**Fix:**
- Memoize components
- Use Zustand selectors
- Virtualize lists
- Code split (Fix #1)

---

## 10. Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                      index.html                       │
│                         │                             │
│                    main.jsx                           │
│                         │                             │
│    ┌────────────────────┼────────────────────────┐   │
│    │              Provider Tree                    │   │
│    │                                              │   │
│    │  ErrorBoundary                               │   │
│    │    └── BrowserRouter                         │   │
│    │         └── DeviceProvider (Context)         │   │
│    │              └── BrandProvider (Context)     │   │
│    │                   └── AppQueryProvider       │   │
│    │                        │                     │   │
│    └────────────────────────┼────────────────────┘   │
│                              │                        │
│                         App.jsx                       │
│                              │                        │
│              ┌───────────────┼───────────────┐       │
│              │      PlayerProvider (Context)  │       │
│              │           │                    │       │
│              │  SpatialNavigationProvider     │       │
│              │           │                    │       │
│              │       Routes (lazy)            │       │
│              └───────────────┼───────────────┘       │
│                              │                        │
│    ┌─────────────────────────┼──────────────────┐    │
│    │                  Pages                     │    │
│    │                                             │    │
│    │  SplashPage    LoginPage    ProfilePage     │    │
│    │  HomePage      BouquetPage  VodPage         │    │
│    │  EpgCardsPage  CatchupPage  SearchPage      │    │
│    │  etc.                                        │    │
│    └─────────────────────────┼──────────────────┘    │
│                              │                        │
│    ┌─────────────────────────┼──────────────────┐    │
│    │            Zustand Stores                  │    │
│    │                                             │    │
│    │  preloadStore    parentalStore              │    │
│    │  parentalGateStore  epgReminderStore        │    │
│    └─────────────────────────────────────────────┘    │
│                                                       │
│    ┌──────────────────────────────────────────────┐  │
│    │           TanStack Query                     │  │
│    │   (Server state, caching, refetching)        │  │
│    └──────────────────────────────────────────────┘  │
│                                                       │
│    ┌──────────────────────────────────────────────┐  │
│    │          Player Engines                       │  │
│    │   LgEngine  SamsungEngine  WebEngine          │  │
│    └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

*Keep this document updated as the project evolves.*
