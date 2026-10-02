"use client";

import { useEffect } from "react";

const CDN = {
  lenis: "https://cdn.jsdelivr.net/npm/lenis@1.2.3/dist/lenis.min.js",
  anime: "https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js",
};

// Strict Mode can mount twice while the first script is still downloading.
// Share the pending load instead of considering an existing tag ready.
const pending = new Map<string, Promise<void>>();
function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  const existing = pending.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`) || document.createElement('script');
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
      if (error) { script.remove(); reject(error); } else resolve();
    };
    const loaded = () => finish(ready() ? undefined : new Error('Biblioteca indisponível.'));
    const failed = () => finish(new Error('Falha ao carregar biblioteca.'));
    const timeout = setTimeout(() => finish(new Error('Tempo de carregamento excedido.')), 10000);
    script.addEventListener('load', loaded);
    script.addEventListener('error', failed);
    if (!script.isConnected) { script.src = src; script.async = true; document.head.appendChild(script); }
  });
  pending.set(src, promise);
  void promise.catch(() => { if (pending.get(src) === promise) pending.delete(src); });
  return promise;
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
      await Promise.allSettled([
        loadScript(CDN.lenis, () => typeof window.Lenis === 'function'),
        loadScript(CDN.anime, () => typeof window.anime === 'function'),
      ]);
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
