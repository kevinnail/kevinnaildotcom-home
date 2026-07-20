import { useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll hook. Returns [ref, isInView]. Fires once: after the element
 * first intersects the viewport it stops observing, so the reveal doesn't replay
 * on every scroll-by. Falls back to visible when IntersectionObserver is absent.
 *
 * @param {{ rootMargin?: string, threshold?: number }} [options]
 */
export default function useInView({ rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = {}) {
  const ref = useRef(null);
  // Fall back to visible up front when IntersectionObserver is unavailable, so
  // the effect never has to set state synchronously to reveal the content.
  const [isInView, setIsInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Reveal on entry, and also if the element is already above the
          // viewport (top < 0) — the observer's first callback carries current
          // geometry, so a restored scroll position still reveals content that
          // loaded already scrolled past instead of stranding it invisible.
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return [ref, isInView];
}
