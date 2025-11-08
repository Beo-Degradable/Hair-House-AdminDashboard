import { useEffect, useState } from 'react';

// Simple hook that returns true when the media query matches
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    try {
      m.addEventListener ? m.addEventListener('change', handler) : m.addListener(handler);
    } catch (e) {
      // older browsers
      m.addListener(handler);
    }
    // sync
    setMatches(m.matches);
    return () => {
      try {
        m.removeEventListener ? m.removeEventListener('change', handler) : m.removeListener(handler);
      } catch (e) {
        m.removeListener(handler);
      }
    };
  }, [query]);

  return matches;
}
