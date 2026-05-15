"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Script from "next/script";

export default function ChatPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
    };
    init();
  }, []);

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    router.replace("/"); 
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0d0a17] via-[#12101f] to-[#0d0a17]" data-saas-container>
      {/* Script do Widget Headless */}
      <Script src="http://localhost:4000/widget.js" data-skill="equilibra" strategy="afterInteractive" />

      <header className="flex items-center justify-between border-b border-purple-500/10 bg-[#0d0a17]/80 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/colaborador")} className="flex h-9 w-9 items-center justify-center rounded-xl text-purple-400/60 transition-colors hover:bg-purple-500/10 hover:text-purple-300" type="button" title="Voltar">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-violet-700 shadow-lg shadow-purple-900/40">
            <span className="material-symbols-outlined text-xl text-white">psychology</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Assistente de Bem-estar</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] text-emerald-400/80">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 sm:flex">
            <span className="material-symbols-outlined text-xs text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
            <span className="text-[11px] font-medium text-emerald-400/80">Confidencial</span>
          </div>
          <button onClick={handleLogout} className="flex h-9 w-9 items-center justify-center rounded-xl text-purple-400/50 transition-colors hover:bg-purple-500/10 hover:text-purple-300" type="button" title="Sair">
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </header>

      <div className="dark-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-8" style={{ maxHeight: "calc(100vh - 140px)" }}>
        <div className="mx-auto max-w-2xl space-y-4" data-saas-messages>
          
          {/* Template para mensagem do USUÁRIO */}
          <div data-saas-template-user style={{ display: "none" }} className="msg-enter flex justify-end">
            <div className="max-w-[75%] rounded-2xl px-5 py-3.5 rounded-br-md bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-lg shadow-purple-900/30">
              <p className="text-[14px] leading-relaxed" data-saas-content></p>
              <p className="mt-1.5 text-right text-[10px] text-white/40">Agora</p>
            </div>
          </div>

          {/* Template para mensagem da IA */}
          <div data-saas-template-ai style={{ display: "none" }} className="msg-enter flex justify-start">
            <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
              <span className="material-symbols-outlined text-base text-purple-400">psychology</span>
            </div>
            <div className="max-w-[75%] rounded-2xl px-5 py-3.5 rounded-bl-md border border-purple-500/10 bg-white/[0.04] text-purple-50 backdrop-blur-sm">
              <p className="text-[14px] leading-relaxed" data-saas-content></p>
              <p className="mt-1.5 text-right text-[10px] text-purple-300/30">Agora</p>
            </div>
          </div>

        </div>
      </div>

      <div className="border-t border-purple-500/10 bg-[#0d0a17]/80 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input 
            data-saas-input
            className="flex-1 rounded-xl border border-purple-500/10 bg-white/[0.04] px-5 py-3.5 text-sm text-purple-50 placeholder-purple-300/25 outline-none transition-all focus:border-purple-500/25 focus:ring-2 focus:ring-purple-500/10"
            placeholder="Digite sua mensagem..." 
          />
          <button 
            data-saas-send
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-lg shadow-purple-900/30 transition-all hover:shadow-xl disabled:opacity-30 disabled:shadow-none" 
            type="button"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-purple-300/20">Conversa 100% anônima • Protegida pela LGPD</p>
      </div>
    </div>
  );
}

