"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api-client";
import { clearAuthSession } from "@/lib/auth-client";

interface Message { id: string; role: "user" | "ai"; text: string; time: string; }

const AI_RESPONSES = [
  "Entendo como você se sente. Pode me contar mais sobre o que está causando esse sentimento?",
  "Obrigado por compartilhar. É completamente normal sentir isso. Como isso tem afetado seu dia a dia no trabalho?",
  "Percebo que essa situação é desafiadora. Vamos explorar juntos algumas estratégias que podem ajudar.",
  "Isso é muito importante. A pressão no trabalho pode impactar significativamente o bem-estar.",
  "Agradeço sua abertura. Lembre-se: buscar ajuda é um sinal de força, não de fraqueza.",
  "Seus sentimentos são válidos. Vamos trabalhar juntos para encontrar um equilíbrio saudável.",
  "É muito corajoso falar sobre isso. A saúde mental é tão importante quanto a saúde física.",
  "Compreendo. Muitas pessoas passam por situações semelhantes. Vamos pensar em passos concretos.",
];

function getTime() { return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load user and existing messages
  useEffect(() => {
    const init = async () => {
      try {
        const res = await authenticatedFetch("/api/colaborador/chat");
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            if (data.sessionId) setSessionId(data.sessionId);
            setMessages(data.history.map((m: any) => ({
              id: m.id,
              role: m.role as "user" | "ai",
              text: m.text,
              time: new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            })));
            setLoaded(true);
            return;
          }
        }
      } catch (err) {
        console.error("Erro ao carregar chat:", err);
      }

      setMessages([{
        id: "welcome", role: "ai",
        text: "Olá! 👋 Sou a assistente de bem-estar da EQUILIBRA. Estou aqui para te ouvir de forma segura e confidencial. Como você está se sentindo hoje?",
        time: getTime(),
      }]);
      setLoaded(true);
    };
    init();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);
  useEffect(() => { if (loaded) inputRef.current?.focus(); }, [loaded]);

  const persistMessage = async (role: "user" | "ai", text: string) => {
    try {
      await authenticatedFetch("/api/colaborador/chat", {
        method: "POST",
        body: JSON.stringify({ sessionId, role, text }),
      });
    } catch { /* ignore */ }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", text, time: getTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    persistMessage("user", text);

    setTyping(true);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1500));
    setTyping(false);

    const aiText = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: aiText, time: getTime() };
    setMessages((prev) => [...prev, aiMsg]);
    persistMessage("ai", aiText);
  };

  const handleLogout = () => {
    clearAuthSession();
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#0d0a17] via-[#12101f] to-[#0d0a17]">
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
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`msg-enter flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                  <span className="material-symbols-outlined text-base text-purple-400">psychology</span>
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user" ? "rounded-br-md bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-lg shadow-purple-900/30"
                  : "rounded-bl-md border border-purple-500/10 bg-white/[0.04] text-purple-50 backdrop-blur-sm"
              }`}>
                <p className="text-[14px] leading-relaxed">{msg.text}</p>
                <p className={`mt-1.5 text-right text-[10px] ${msg.role === "user" ? "text-white/40" : "text-purple-300/30"}`}>{msg.time}</p>
              </div>
            </div>
          ))}
          {typing && (
            <div className="msg-enter flex justify-start">
              <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <span className="material-symbols-outlined text-base text-purple-400">psychology</span>
              </div>
              <div className="rounded-2xl rounded-bl-md border border-purple-500/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (<span key={i} className="h-2 w-2 rounded-full bg-purple-400/60" style={{ animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-purple-500/10 bg-[#0d0a17]/80 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input ref={inputRef}
            className="flex-1 rounded-xl border border-purple-500/10 bg-white/[0.04] px-5 py-3.5 text-sm text-purple-50 placeholder-purple-300/25 outline-none transition-all focus:border-purple-500/25 focus:ring-2 focus:ring-purple-500/10"
            placeholder="Digite sua mensagem..." value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={typing} />
          <button onClick={sendMessage} disabled={typing || !input.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 text-white shadow-lg shadow-purple-900/30 transition-all hover:shadow-xl disabled:opacity-30 disabled:shadow-none" type="button">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-purple-300/20">Conversa 100% anônima • Protegida pela LGPD</p>
      </div>
    </div>
  );
}
