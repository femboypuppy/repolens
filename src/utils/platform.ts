/** Platform and accessibility-preference helpers. */
import { useEffect, useState } from 'react';

export const isMacOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /mac/i.test(platform) && !/iphone|ipad/i.test(navigator.userAgent);
};

export const isWindows = (): boolean =>
  typeof navigator !== 'undefined' && /win/i.test(navigator.platform || navigator.userAgent);

/** Display label for the primary modifier key. */
export const modKeyLabel = (): string => (isMacOS() ? '⌘' : 'Ctrl+');

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/** True when the OS asks for reduced transparency (where the browser engine exposes it). */
export const usePrefersReducedTransparency = () => useMediaQuery('(prefers-reduced-transparency: reduce)');
export const usePrefersDark = () => useMediaQuery('(prefers-color-scheme: dark)');
