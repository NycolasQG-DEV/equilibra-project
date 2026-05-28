"use client";

import { useRef, useState } from "react";
import { useExternalLibs } from "@/hooks/useExternalLibs";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AuthCard } from "@/components/auth/AuthCard";

export default function HomePage() {
  const [authMode, setAuthMode] = useState<"signup" | "login">("login");
  const lenisRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  useExternalLibs(() => {
    const anime = window.anime;

    // Lenis
    const lenis = new window.Lenis({ duration: 1.4, smoothWheel: true });
    lenisRef.current = lenis;
    const raf = (time: number) => { lenis.raf(time); rafRef.current = requestAnimationFrame(raf); };
    rafRef.current = requestAnimationFrame(raf);

    // Animações de entrada
    anime({ targets: "header", translateY: [-50, 0], opacity: [0, 1], duration: 700, easing: "easeOutExpo" });
    anime({ targets: ".hero-title, .hero-desc, .hero-btns", translateY: [50, 0], opacity: [0, 1], delay: anime.stagger(130, { start: 300 }), duration: 850, easing: "easeOutExpo" });
    anime({ targets: ".hero-image", scale: [0.93, 1], opacity: [0, 1], duration: 1100, delay: 450, easing: "easeOutExpo" });
    anime({ targets: ".hero-orb", scale: [0.6, 1], opacity: [0, 1], duration: 1400, delay: 200, easing: "easeOutExpo" });

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        anime({ targets: el, opacity: [0, 1], translateY: [40, 0], duration: 750, delay: parseInt(el.dataset.delay ?? "0", 10), easing: "easeOutExpo" });
        observer.unobserve(el);
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    // Hover nos CTAs
    document.querySelectorAll<HTMLElement>(".cta-btn").forEach((btn) => {
      btn.addEventListener("mouseenter", () => anime({ targets: btn, scale: 1.05, duration: 280, easing: "easeOutSine" }));
      btn.addEventListener("mouseleave", () => anime({ targets: btn, scale: 1, duration: 300, easing: "easeOutSine" }));
    });

    // Cleanup on unmount
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lenis.destroy();
      observer.disconnect();
    };
  });

  const goToAuth = (mode: "signup" | "login") => {
    setAuthMode(mode);
    const target = document.getElementById("auth-section");
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -80, duration: 1.6 });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleBtnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!window.anime) return;
    window.anime({ targets: e.currentTarget, scale: [1, 0.93, 1], duration: 380, easing: "easeOutElastic(1, .5)" });
  };

  return (
    <>
      <SiteHeader onLogin={() => goToAuth("login")} onSignup={() => goToAuth("signup")} />

      <main className="bg-[#F8F6FB] pb-0 pt-24 text-[#1d1a20]">

        {/* Hero */}
        <section className="mx-auto flex max-w-[1280px] flex-col items-center gap-16 px-8 py-20 lg:flex-row">
          <div className="flex-1 space-y-8">
            <h1 className="hero-title font-['Epilogue'] text-5xl font-bold leading-tight tracking-tight text-[#260054]" style={{ opacity: 0 }}>
              Saúde mental no trabalho.<br />
              <span className="text-[#6b538c]">Conformidade NR-1.</span><br />
              Tudo em um lugar.
            </h1>
            <p className="hero-desc max-w-xl text-lg text-[#4a4550]" style={{ opacity: 0 }}>
              Transforme a gestão de bem-estar da sua empresa com inteligência
              artificial e rigor clínico. Garanta conformidade legal enquanto
              cuida do seu maior ativo: as pessoas.
            </p>
            <div className="hero-btns flex flex-wrap gap-4 pt-4" style={{ opacity: 0 }}>
              <button
                className="cta-btn flex items-center gap-2 rounded-xl bg-[#3d1a6e] px-8 py-4 text-base font-bold text-white will-change-transform"
                onClick={(e) => { handleBtnClick(e); goToAuth("signup"); }} type="button"
              >
                Criar conta grátis
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button
                className="cta-btn rounded-xl border-2 border-[#ccc3d2] px-8 py-4 text-base font-bold text-[#260054] transition-colors hover:bg-[#f3ecf4] will-change-transform"
                onClick={(e) => { handleBtnClick(e); goToAuth("login"); }} type="button"
              >
                Já tenho conta — fazer login
              </button>
            </div>
          </div>
          <div className="relative flex-1">
            <div className="hero-orb absolute -left-12 -top-12 h-64 w-64 rounded-full bg-[#dabdfe]/30 blur-3xl" style={{ opacity: 0 }} />
            <div className="hero-image relative overflow-hidden rounded-3xl border border-purple-200/40 p-4 shadow-2xl will-change-transform" style={{ opacity: 0, background: "rgba(237,230,247,0.4)", backdropFilter: "blur(12px)" }}>
              <img alt="Dashboard Preview" className="w-full rounded-2xl"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZvr7uovyZqB9_zajePO7HzQrZyvTCfENbBs-5akWQ3FPjg5ww-IVRKWBzJd7O5TBuj_bwShY_m7zlVvBkFpTvYya17otXcGlkMon39YOV35XXA07msKM86_pBnU2qPJt1ib6h2ISAJeipOgblT4QCfcms6YNBMAAEL1ctTdjWwN_wXrHbrv6hUtw4liuPJnvN7fNWDALSPsKw3XslKj0aAh5awQtRKMoYCfvrtMaGwVZG6-IO3xHioirlqiJUmBfNsVtZlONKcMwP"
              />
            </div>
          </div>
        </section>

        {/* Auth Section */}
        <section className="reveal bg-[#EDE6F7] py-24" id="auth-section" style={{ opacity: 0 }} data-delay="0">
          <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-12 px-8 lg:flex-row">
            <div className="flex-1">
              <h2 className="reveal font-['Epilogue'] mb-6 text-4xl font-bold text-[#260054]" style={{ opacity: 0 }} data-delay="100">
                Tudo começa com um passo seguro.
              </h2>
              <p className="reveal text-lg text-[#4a4550]" style={{ opacity: 0 }} data-delay="200">
                Nossa plataforma de autenticação unificada garante que o acesso
                à saúde mental seja simples e discreto.
              </p>
            </div>
            <div className="reveal flex flex-1 justify-center" style={{ opacity: 0 }} data-delay="150">
              <AuthCard mode={authMode} onModeChange={setAuthMode} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
