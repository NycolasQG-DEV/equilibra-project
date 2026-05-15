"use client";

import { useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface Message { id: string; role: "user" | "ai"; text: string; time: string; }

const AI_RESPONSES = [
  "Com base nos dados das pesquisas, posso ajudar a interpretar os indicadores de risco psicossocial. O que gostaria de entender melhor?",
  "A NR-1 exige que empresas identifiquem e mitiguem riscos psicossociais. Posso explicar como cada indicador se relaciona com a norma.",
  "Analisando os dados disponíveis, recomendo focar nos setores com maior concentração de risco alto. Deseja que eu detalhe?",
  "O score médio indica o nível geral de estresse organizacional. Valores acima de 16 (de 24) sugerem necessidade de intervenção.",
  "Para conformidade NR-1, o ideal é manter a taxa de risco alto abaixo de 30% e a taxa de resposta acima de 70%.",
  "Posso explicar a diferença entre os níveis de risco e quais ações são recomendadas para cada faixa.",
  "Os dados sugerem que pesquisas regulares (mensais ou trimestrais) são essenciais para acompanhar a evolução dos indicadores.",
  "A LGPD garante que os dados individuais são protegidos. Os relatórios mostram apenas indicadores agregados, sem identificar colaboradores.",
];

function getTime() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export default function AdminChatPage() {
  const { user, loading } = useAuth("admin");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: history } = await supabase
        .from("admin_chat_messages")
        .select("*")
        .eq("admin_id", user.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (history && history.length > 0) {
        setMessages(history.map((m) => ({
          id: m.id, role: m.role as "user" | "ai", text: m.text,
          time: new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        })));
      } else {
        setMessages([{
          id: "welcome", role: "ai",
          text: "Olá! 👋 Sou a assistente de inteligência da EQUILIBRA. Estou aqui para ajudar você a entender os dados das pesquisas, indicadores NR-1 e recomendar ações. O que gostaria de saber?",
          time: getTime(),
        }]);
      }
      setLoaded(true);
    };
    init();
  }, [user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);
  useEffect(() => { if (loaded) inputRef.current?.focus(); }, [loaded]);

  const persist = async (role: "user" | "ai", text: string) => {
    if (!user) return;
    await supabase.from("admin_chat_messages").insert([{ admin_id: user.id, role, text }]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || typing) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    persist("user", text);

    setTyping(true);
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500));
    setTyping(false);

    const aiText = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: aiText, time: getTime() };
    setMessages((prev) => [...prev, aiMsg]);
    persist("ai", aiText);
  };

  if (loading) return <LoadingSpinner message="Verificando acesso..." />;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b border-purple-100 bg-white px-8 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3d1a6e] to-[#6b538c] shadow-lg">
            <span className="material-symbols-outlined text-xl text-white">smart_toy</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#260054]">Chat IA — Assistente NR-1</h1>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-600">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Future AI banner */}
      <div className="mx-8 mt-4 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3">
        <span className="material-symbols-outlined text-blue-600">info</span>
        <p className="text-xs text-blue-700">
          <strong>Em breve:</strong> a IA responderá com base nos dados reais das suas pesquisas, oferecendo análises detalhadas e recomendações personalizadas.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                  <span className="material-symbols-outlined text-base text-[#3d1a6e]">smart_toy</span>
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "rounded-br-md bg-[#3d1a6e] text-white shadow-md"
                  : "rounded-bl-md border border-purple-100 bg-purple-50/50 text-[#260054]"
              }`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className={`mt-1.5 text-right text-[10px] ${msg.role === "user" ? "text-white/40" : "text-[#4a4550]/40"}`}>{msg.time}</p>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <span className="material-symbols-outlined text-base text-[#3d1a6e]">smart_toy</span>
              </div>
              <div className="rounded-2xl rounded-bl-md border border-purple-100 bg-purple-50/50 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (<span key={i} className="h-2 w-2 rounded-full bg-[#6b538c]" style={{ animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-purple-100 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input ref={inputRef}
            className="flex-1 rounded-xl border border-purple-200 bg-white px-5 py-3.5 text-sm text-[#260054] placeholder-[#4a4550]/40 outline-none transition-all focus:border-[#6b538c] focus:ring-2 focus:ring-[#dabdfe]"
            placeholder="Pergunte sobre NR-1, indicadores de risco, recomendações..." value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={typing} />
          <button onClick={sendMessage} disabled={typing || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#3d1a6e] text-white shadow-md transition-all hover:bg-[#2D1052] disabled:opacity-30" type="button">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
