"use client";

import { useEffect, useState } from "react";

interface CookieCategory {
  id: string;
  name: string;
  required: boolean;
  enabled: boolean;
  description: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [categories, setCategories] = useState<CookieCategory[]>([
    {
      id: "essential",
      name: "Cookies Estritamente Necessários",
      required: true,
      enabled: true,
      description: "Essenciais para manter a autenticação de administradores, proteger a segurança e viabilizar a navegação das pesquisas.",
    },
    {
      id: "preferences",
      name: "Preferências e Interface",
      required: false,
      enabled: true,
      description: "Lembram suas configurações como preferências de voz da IA (TTS), filtros do painel e modo de exibição.",
    },
    {
      id: "analytics",
      name: "Métricas e Desempenho",
      required: false,
      enabled: false,
      description: "Auxiliam a monitorar o tempo de resposta do sistema e estabilidade de carregamento sem identificar individualmente o usuário.",
    },
  ]);

  useEffect(() => {
    const stored = localStorage.getItem("equilibra_cookie_consent");
    if (!stored) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    saveConsent("all", { essential: true, preferences: true, analytics: true });
  };

  const handleEssentialOnly = () => {
    saveConsent("essential", { essential: true, preferences: false, analytics: false });
  };

  const handleSaveCustom = () => {
    const prefs = categories.reduce((acc, cat) => {
      acc[cat.id] = cat.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    saveConsent("custom", prefs);
    setShowManageModal(false);
  };

  const saveConsent = (type: string, details: Record<string, boolean>) => {
    localStorage.setItem("equilibra_cookie_consent", type);
    localStorage.setItem("equilibra_cookie_preferences", JSON.stringify(details));
    document.cookie = `equilibra_cookie_consent=${type}; path=/; max-age=31536000; SameSite=Lax`;
    setVisible(false);
  };

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id && !cat.required ? { ...cat, enabled: !cat.enabled } : cat))
    );
  };

  return (
    <>
      {/* Botão flutuante para reabrir gerenciador se já tiver respondido */}
      {!visible && (
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="fixed bottom-4 right-4 z-40 flex h-9 items-center gap-1.5 rounded-full border border-slate-700/80 bg-[#0f172a]/90 px-3 text-[11px] font-medium text-slate-300 shadow-lg backdrop-blur-md transition-all hover:border-sky-500/50 hover:bg-[#1e293b] hover:text-white"
          title="Gerenciar Preferências de Cookies"
        >
          <i className="fa-solid fa-cookie-bite text-sky-400"></i>
          <span>Privacidade & Cookies</span>
        </button>
      )}

      {/* Banner no Canto Inferior Direito (Bottom-Right) */}
      {visible && (
        <aside
          aria-label="Aviso de Cookies e Privacidade"
          className="fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-2xl border border-slate-700/70 bg-[#0f1726]/95 p-5 text-slate-100 shadow-2xl backdrop-blur-xl transition-all animate-fade-in"
          style={{
            boxShadow: "0 20px 45px rgba(0, 0, 0, 0.6), 0 0 20px rgba(2, 132, 199, 0.15)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <i className="fa-solid fa-cookie-bite text-base"></i>
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white tracking-tight">Privacidade & Cookies</h4>
              <p className="text-xs text-slate-300/85 leading-relaxed">
                Utilizamos cookies para assegurar o funcionamento dos links, salvar sua autenticação e aprimorar a experiência de uso.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-2.5 text-xs font-semibold text-white shadow-md shadow-sky-950/40 transition-all hover:from-sky-500 hover:to-sky-600 active:scale-95"
            >
              Aceitar Todos
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEssentialOnly}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
              >
                Apenas Essenciais
              </button>
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/60 py-2 text-xs font-medium text-sky-400 hover:bg-slate-700/60 hover:text-sky-300 transition-colors"
              >
                Gerenciar
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Modal Profissional de Gerenciamento de Cookies */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0f172a] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-sliders text-sky-400"></i>
                <h3 className="font-bold text-white text-base">Central de Preferências de Cookies</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300/80">
              Personalize como os cookies são utilizados em sua navegação. Os cookies estritamente necessários não podem ser desativados pois garantem a segurança da sessão e respostas da avaliação.
            </p>

            <div className="mt-5 space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{cat.name}</span>
                      {cat.required && (
                        <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300 border border-sky-500/30">
                          Sempre Ativo
                        </span>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cat.enabled}
                        disabled={cat.required}
                        onChange={() => toggleCategory(cat.id)}
                        className="sr-only peer"
                      />
                      <div className={`h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-sky-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full ${cat.required ? "opacity-60 cursor-not-allowed" : ""}`} />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    {cat.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={handleSaveCustom}
                className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:from-sky-500 hover:to-sky-600"
              >
                Salvar Preferências
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Aceitar Todos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

