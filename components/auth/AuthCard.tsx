"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types/database";
import { ROLE_ROUTES } from "@/lib/constants";
import { setAuthSession } from "@/lib/auth-client";

interface AuthCardProps {
  mode: "signup" | "login";
  onModeChange: (mode: "signup" | "login") => void;
}

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const router = useRouter();

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  /* ─── Signup ─── */
  const handleSignup = async () => {
    setSignupError("");
    setSignupSuccess("");
    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError("Preencha todos os campos.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      setSignupError("Formato de e-mail inválido.");
      return;
    }
    if (signupPassword.length < 8) {
      setSignupError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || `Falha na comunicação com o servidor (${res.status}).`);
      }

      setAuthSession(data.token, data.user);
      router.push("/planos");
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setSignupLoading(false);
    }
  };

  /* ─── Login ─── */
  const handleLogin = async () => {
    setLoginError("");
    setForgotMsg("");
    if (!loginEmail || !loginPassword) {
      setLoginError("Preencha todos os campos.");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || `Falha na autenticação (${res.status}).`);
      }

      setAuthSession(data.token, data.user);
      const user = data.user;
      const role = user.role as UserRole;

      // Admin sem plano → mandar para planos
      if (role === "admin" && (!user.plan || user.plan === "none")) {
        router.push("/planos");
        return;
      }

      router.push(ROLE_ROUTES[role] ?? "/colaborador");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ─── Forgot ─── */
  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setLoginError("Digite seu e-mail acima para recuperar a senha.");
      return;
    }
    setForgotLoading(true);
    setLoginError("");
    setForgotMsg("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      const isJson = res.headers.get("content-type")?.includes("application/json");
      const data = isJson ? await res.json() : null;
      if (!res.ok) {
        throw new Error(data?.error || `Erro ao solicitar redefinição (${res.status}).`);
      }
      setForgotMsg(data?.message || "Solicitação enviada. Verifique sua caixa de entrada.");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
    } finally {
      setForgotLoading(false);
    }
  };

  const switchMode = (next: "signup" | "login") => {
    if (next === mode) return;
    onModeChange(next);
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-purple-200 bg-white shadow-2xl">
      {/* Tabs */}
      <div className="flex border-b border-purple-100">
        {(["signup", "login"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-5 transition-colors ${
              mode === tab
                ? "border-b-4 border-[#260054] font-bold text-[#260054]"
                : "font-medium text-[#4a4550] hover:bg-purple-50"
            }`}
            onClick={() => switchMode(tab)}
            type="button"
          >
            {tab === "signup" ? "Criar Conta" : "Entrar"}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ width: "200%", transform: mode === "signup" ? "translateX(0%)" : "translateX(-50%)" }}
        >
          {/* ─── Signup ─── */}
          <div className="space-y-4 px-10 py-8" style={{ width: "50%" }}>
            <Field label="Nome" placeholder="Seu nome completo" type="text" value={signupName} onChange={setSignupName} />
            <Field label="E-mail" placeholder="nome@empresa.com.br" type="email" value={signupEmail} onChange={setSignupEmail} />
            <Field label="Senha" placeholder="Mínimo 8 caracteres" type="password" value={signupPassword} onChange={setSignupPassword} onEnter={handleSignup} />
            {signupError && <Msg type="error" text={signupError} />}
            {signupSuccess && <Msg type="success" text={signupSuccess} />}
            <Btn onClick={handleSignup} loading={signupLoading} label="Criar Conta" loadingLabel="Criando conta..." />
          </div>

          {/* ─── Login ─── */}
          <div className="space-y-4 px-10 py-8" style={{ width: "50%" }}>
            <Field label="E-mail" placeholder="nome@empresa.com.br" type="email" value={loginEmail} onChange={setLoginEmail} />
            <Field label="Senha" placeholder="••••••••" type="password" value={loginPassword} onChange={setLoginPassword} onEnter={handleLogin} />
            {loginError && <Msg type="error" text={loginError} />}
            {forgotMsg && <Msg type="success" text={forgotMsg} />}
            <Btn onClick={handleLogin} loading={loginLoading} label="Entrar" loadingLabel="Entrando..." />
            <button
              className="w-full text-sm text-[#260054]/80 hover:underline disabled:opacity-50"
              type="button"
              disabled={forgotLoading}
              onClick={handleForgotPassword}
            >
              {forgotLoading ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function Field({
  label,
  placeholder,
  type,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  placeholder: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">{label}</label>
      <input
        className="w-full rounded-xl border border-[#ccc3d2] px-4 py-3 outline-none transition-all focus:border-[#6b538c] focus:ring-2 focus:ring-[#dabdfe]"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
        }}
      />
    </div>
  );
}

function Msg({ type, text }: { type: "error" | "success"; text: string }) {
  return (
    <p
      className={`rounded-lg px-4 py-3 text-sm ${
        type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
      }`}
    >
      {text}
    </p>
  );
}

function Btn({
  onClick,
  loading,
  label,
  loadingLabel,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white transition-all hover:bg-[#2D1052] hover:shadow-lg disabled:opacity-60"
      type="button"
      disabled={loading}
      onClick={onClick}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
