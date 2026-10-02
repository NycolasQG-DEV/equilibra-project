'use client';
import { useExternalLibs } from '@/hooks/useExternalLibs';

export function AdminMotion() {
  useExternalLibs(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let lenis: InstanceType<typeof window.Lenis> | null = null;
    let frame = 0;
    const stop = () => { cancelAnimationFrame(frame); lenis?.destroy(); lenis = null; };
    const sync = () => {
      stop();
      if (preference.matches || typeof window.Lenis !== 'function') return;
      lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, prevent: (node: HTMLElement) => !!node.closest('[role="dialog"], .eq-sidebar, [data-lenis-prevent]') });
      const tick = (time: number) => { lenis?.raf(time); frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    };
    sync();
    preference.addEventListener('change', sync);
    return () => { stop(); preference.removeEventListener('change', sync); };
  });
  return null;
}
