"use client";

import { useEffect } from "react";

const CDN = {
  lenis: "https://cdn.jsdelivr.net/npm/lenis@1.2.3/dist/lenis.min.js",
  anime: "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js",
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Load external CDN scripts (Lenis + anime.js) and call onReady when done.
 * onReady may return a cleanup function that runs on unmount.
 */
export function useExternalLibs(onReady: () => (() => void) | void) {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | void;
    const init = async () => {
      await loadScript(CDN.lenis);
      await loadScript(CDN.anime);
      if (!cancelled) {
        cleanup = onReady();
      }
    };
    init();
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
