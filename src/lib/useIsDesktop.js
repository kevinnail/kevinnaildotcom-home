import { useSyncExternalStore } from 'react';

// Tracks whether the viewport is at or above Tailwind's `md` breakpoint (768px).
// Used to branch interaction behaviour that CSS alone can't express — e.g. tapping
// a thumbnail opens the photo dock immediately on desktop but defers to a manual
// "View photo" step on mobile, where the dock would otherwise cover the globe.
const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange) {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(DESKTOP_QUERY).matches;

// Server render has no viewport; assume desktop so SSR/first paint matches the
// wider layout, then the store corrects it on the client.
const getServerSnapshot = () => true;

export default function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
