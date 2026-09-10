import { useEffect, useState } from "react";

/**
 * Layout breakpoints, matched to Tailwind's so JSX and CSS agree:
 * phone < 768 (md), everything else gets the desktop composition.
 * Server-safe: initial value is read synchronously in the browser so the
 * first paint already has the right layout (no phone→desktop flash).
 */
function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export const useIsPhone = () => useMediaQuery("(max-width: 767px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
