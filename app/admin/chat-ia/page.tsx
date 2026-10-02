"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/api-client";
import { PageReveal } from "@/components/admin/PageReveal";

export default function ChatIAPage() {
  const { user } = useAuth("admin");
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      authenticatedFetch("/api/admin/chat")
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setMessages(d.history || []);
        })
        .catch((e) => setError(e.message));
    }
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e?: React.FormEvent, customText?: string) {
    if (e) e.preventDefault();
    const q = customText || input;
    if (!q.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: q, role: "user" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao consultar a assistente.");
      setMessages((m) => [
        ...m,
        { id: Date.now(), role: "user", text: q },
        { id: d.id || Date.now() + 1, role: "ai", text: d.text },
      ]);
      if (!customText) setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const SUGGESTIONS = [
    "Quais são os principais fatores de risco observados na última rodada?",
    "Quais ações preventivas para SST você recomenda com base nos dados?",
    "Como está a taxa de adesão e participação dos colaboradores?",
    "O que mudou em relação à rodada anterior?",
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8 text-slate-800">
      <PageReveal selector=".pg-reveal" />

      {/* Header */}
      <header className="pg-reveal space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
          <span className="material-symbols-outlined text-base">smart_toy</span>
          EQUILIBRA · INTELIGÊNCIA ARTIFICIAL DE GESTÃO
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Análise Inteligente e Recomendações
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
          Consulte insights analíticos consolidados sobre saúde corporativa, clima de trabalho e diretrizes da NR-1 sem violar o sigilo individual.
        </p>
      </header>

      {/* Suggested Prompts */}
      <div className="pg-reveal space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sugestões de consulta</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => send(undefined, sug)}
              disabled={busy}
              className="rounded-xl border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-700 px-3.5 py-2 text-xs font-medium transition-all text-left disabled:opacity-50"
            >
              <span className="mr-1.5 opacity-70">💡</span>
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Messages container */}
      <div className="pg-reveal space-y-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm min-h-[360px] flex flex-col justify-between">
        <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Nenhuma conversa iniciada</p>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Selecione uma das sugestões acima ou digite sua dúvida no campo abaixo para consultar a base de dados agregada.
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <article
                key={m.id}
                className={`flex gap-3 text-sm ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {!isUser && (
                  <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <span className="material-symbols-outlined text-base">smart_toy</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm shadow-md"
                      : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                  }`}
                >
                  <p className={`text-[11px] font-bold mb-1.5 ${isUser ? "text-indigo-200" : "text-indigo-700"}`}>
                    {isUser ? "Você" : "Assistente Equilibra"}
                  </p>
                  <div>{m.text}</div>
                </div>
                {isUser && (
                  <div className="h-8 w-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <span className="material-symbols-outlined text-base">person</span>
                  </div>
                )}
              </article>
            );
          })}

          {busy && (
            <div className="flex gap-3 text-sm justify-start items-center">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <span className="material-symbols-outlined text-base">smart_toy</span>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-50 border border-slate-200 p-4 text-xs sm:text-sm text-slate-500 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-indigo-600 animate-ping" />
                <span>Analisando métricas e elaborando diagnóstico...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={send} className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
          <label className="sr-only" htmlFor="message">
            Sua pergunta
          </label>
          <input
            id="message"
            value={input}
            maxLength={1200}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            placeholder="Faça uma pergunta sobre os resultados, clima ou recomendações..."
          />
          <button
            type="submit"
            disabled={busy || input.trim().length < 2}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-xs sm:text-sm font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <span>{busy ? "Enviando..." : "Enviar"}</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </form>
      </div>
    </main>
  );
}
