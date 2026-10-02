'use client';
import { useExternalLibs } from '@/hooks/useExternalLibs';

/**
 * Drop this component anywhere inside an admin page to get
 * staggered entrance animations on elements with `.pg-reveal`.
 * Uses the already-loaded anime.js from AdminMotion / useExternalLibs.
 */
export function PageReveal({
  selector = '.pg-reveal',
  staggerStart = 60,
  delay = 80,
}: {
  selector?: string;
  staggerStart?: number;
  delay?: number;
}) {
  useExternalLibs(() => {
    const anime = window.anime;
    if (typeof anime !== 'function') return;
    const targets = document.querySelectorAll(selector);
    if (!targets.length) return;
    anime({
      targets,
      translateY: [24, 0],
      opacity: [0, 1],
      delay: anime.stagger(delay, { start: staggerStart }),
      duration: 600,
      easing: 'easeOutExpo',
    });
  });
  return null;
}
