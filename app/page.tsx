"use client";
import { useEffect, useRef, useState } from "react";
import { useExternalLibs } from "@/hooks/useExternalLibs";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AuthCard } from "@/components/auth/AuthCard";
import { getStoredToken, getStoredUser } from "@/lib/auth-client";

export default function HomePage() {
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const lenisRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. Redirecionamento de pesquisa
      const params = new URLSearchParams(window.location.search);
      const link = params.get("link") || params.get("linkId") || params.get("campaign");
      if (link) {
        window.location.href = `/colaborador?link=${encodeURIComponent(link)}`;
        return;
      }

      // 2. Se já possui token de autenticação nos cookies/localStorage, valida e redireciona direto para o painel do ADM
      const token = getStoredToken();
      const user = getStoredUser();

      if (token) {
        // Validação rápida no backend
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => {
            if (res.ok) {
              window.location.href = "/admin";
            } else {
              setIsCheckingAuth(false);
            }
          })
          .catch(() => {
            if (user) {
              window.location.href = "/admin";
            } else {
              setIsCheckingAuth(false);
            }
          });
      } else {
        setIsCheckingAuth(false);
      }
    }
  }, []);


  useExternalLibs(() => {
    const anime = window.anime;

    // Lenis
    const lenis = typeof window.Lenis === 'function' ? new window.Lenis({ duration: 1.4, smoothWheel: true }) : null;
    lenisRef.current = lenis;
    const raf = (time: number) => { lenis?.raf(time); rafRef.current = requestAnimationFrame(raf); };
    if (lenis) rafRef.current = requestAnimationFrame(raf);
    const destroyScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lenis?.destroy();
      lenisRef.current = null;
    };
    if (typeof anime !== 'function') return destroyScroll;

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
    const removeHover = Array.from(document.querySelectorAll<HTMLElement>(".cta-btn")).map((btn) => {
      const enter = () => anime({ targets: btn, scale: 1.05, duration: 280, easing: "easeOutSine" });
      const leave = () => anime({ targets: btn, scale: 1, duration: 300, easing: "easeOutSine" });
      btn.addEventListener("mouseenter", enter);
      btn.addEventListener("mouseleave", leave);
      return () => { btn.removeEventListener("mouseenter", enter); btn.removeEventListener("mouseleave", leave); };
    });

    // Cleanup on unmount
    return () => {
      destroyScroll();
      removeHover.forEach(remove => remove());
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
    if (typeof window.anime !== 'function') return;
    window.anime({ targets: e.currentTarget, scale: [1, 0.93, 1], duration: 380, easing: "easeOutElastic(1, .5)" });
  };

  return (
    <>
      <SiteHeader onLogin={() => goToAuth("login")} onSignup={() => goToAuth("signup")} />

      <main className="bg-[#F8F6FB] pb-0 pt-24 text-[#1d1a20]">

        {/* Hero */}
        <section className="mx-auto flex max-w-[1280px] flex-col items-center gap-16 px-8 py-20 lg:flex-row">
          <div className="flex-1 space-y-8">
            <h1 className="hero-title font-['Epilogue'] text-5xl font-bold leading-tight tracking-tight text-[#260054]">
              Saúde mental no trabalho.<br />
              <span className="text-[#6b538c]">Gestão e Bem-Estar.</span><br />
              Tudo em um lugar.
            </h1>
            <p className="hero-desc max-w-xl text-lg text-[#4a4550]">
              Crie pesquisas sobre condições de trabalho com apoio de IA, compartilhe convites
              e acompanhe resultados agregados para orientar as equipes de RH e SST.
            </p>
            <div className="hero-btns flex flex-wrap gap-4 pt-4">
              <button
                className="cta-btn flex items-center gap-2 rounded-xl bg-[#3d1a6e] px-8 py-4 text-base font-bold text-white will-change-transform"
                onClick={(e) => { handleBtnClick(e); goToAuth("signup"); }} type="button"
              >
                Começar cadastro
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
            <div className="hero-orb absolute -left-12 -top-12 h-64 w-64 rounded-full bg-[#dabdfe]/30 blur-3xl" />
            <div className="hero-image relative overflow-hidden rounded-3xl border border-purple-200/40 p-4 shadow-2xl will-change-transform" style={{ background: "rgba(237,230,247,0.4)", backdropFilter: "blur(12px)" }}>
              <img alt="Dashboard Preview" className="w-full rounded-2xl"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZvr7uovyZqB9_zajePO7HzQrZyvTCfENbBs-5akWQ3FPjg5ww-IVRKWBzJd7O5TBuj_bwShY_m7zlVvBkFpTvYya17otXcGlkMon39YOV35XXA07msKM86_pBnU2qPJt1ib6h2ISAJeipOgblT4QCfcms6YNBMAAEL1ctTdjWwN_wXrHbrv6hUtw4liuPJnvN7fNWDALSPsKw3XslKj0aAh5awQtRKMoYCfvrtMaGwVZG6-IO3xHioirlqiJUmBfNsVtZlONKcMwP"
              />
            </div>
          </div>
        </section>

        {/* Auth Section */}
        <section className="reveal bg-[#EDE6F7] py-24" id="auth-section" data-delay="0">
          <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-12 px-8 lg:flex-row">
            <div className="flex-1">
              <h2 className="reveal font-['Epilogue'] mb-6 text-4xl font-bold text-[#260054]" data-delay="100">
                Tudo começa com um passo seguro.
              </h2>
              <p className="reveal text-lg text-[#4a4550]" data-delay="200">
                Nossa plataforma de autenticação unificada garante que o acesso
                à saúde mental seja simples e discreto.
              </p>
            </div>
            <div className="reveal flex flex-1 justify-center" data-delay="150">
              <AuthCard mode={authMode} onModeChange={setAuthMode} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
