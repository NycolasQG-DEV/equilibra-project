"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/types/database";
import { ROLE_ROUTES } from "@/lib/constants";

interface AuthCardProps {
  mode: "signup" | "login";
  onModeChange: (mode: "signup" | "login") => void;
}

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const router = useRouter();

  const [signupCnpj, setSignupCnpj] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");

  // Estados extras para o CNPJ Profissional
  const [cnpjSearching, setCnpjSearching] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  const [googleLoading, setGoogleLoading] = useState(false);

  /* ─── Google OAuth ─── */
  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setLoginError(error.message);
      setGoogleLoading(false);
    }
  };

  /* ─── Busca Automática de CNPJ (BrasilAPI) ─── */
  const fetchCnpjData = async (cnpjNumber: string) => {
    const cleanCnpj = cnpjNumber.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;
    
    setCnpjSearching(true);
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!res.ok) throw new Error("CNPJ inválido ou não encontrado.");
      const data = await res.json();
      
      // Auto-preencher o nome da empresa
      const companyName = data.nome_fantasia || data.razao_social || "";
      setSignupName(companyName);
      setSignupError(""); // limpa erros antigos
    } catch (err: any) {
      setCnpjError(err.message || "Erro ao buscar CNPJ.");
      setSignupName("");
    } finally {
      setCnpjSearching(false);
    }
  };

  /* ─── Signup ─── */
  const handleSignup = async () => {
    setSignupError(""); setSignupSuccess("");
    if (!signupName || !signupEmail || !signupCnpj || !signupPassword) { setSignupError("Preencha todos os campos."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) { setSignupError("Formato de e-mail inválido."); return; }
    if (signupPassword.length < 8) { setSignupError("A senha deve ter pelo menos 8 caracteres."); return; }
    setSignupLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail, password: signupPassword,
        options: { data: { name: signupName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar usuário.");

      // Criar perfil na tabela users como admin
      await supabase.from("users").upsert([{
        id: authData.user.id,
        name: signupName,
        email: signupEmail,
        cnpj: signupCnpj,
        role: "admin" as UserRole,
        plan: "none",
        max_colaboradores: 0,
      }], { onConflict: "id" });

      if (authData.session) {
        router.push("/planos");
      } else {
        setSignupSuccess("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally { setSignupLoading(false); }
  };

  /* ─── Login ─── */
  const handleLogin = async () => {
    router.push("/colaborador/chat");
  };

  /* ─── Forgot ─── */
  const handleForgotPassword = async () => {
    if (!loginEmail) { setLoginError("Digite seu e-mail acima para recuperar a senha."); return; }
    setForgotLoading(true); setLoginError(""); setForgotMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setForgotMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
    } finally { setForgotLoading(false); }
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
              mode === tab ? "border-b-4 border-[#260054] font-bold text-[#260054]" : "font-medium text-[#4a4550] hover:bg-purple-50"
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
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-purple-200 py-3 font-semibold text-[#260054] transition-all hover:bg-purple-50 disabled:opacity-50"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.02 10.02 0 0 0 2 12c0 1.61.39 3.14 1.08 4.49l3.76-2.4z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? "Conectando..." : "Continuar com Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-purple-100" />
              <span className="text-xs font-medium text-[#4a4550]">ou</span>
              <div className="h-px flex-1 bg-purple-100" />
            </div>

            <div className="space-y-1">
              <Field 
                label="CNPJ da Empresa" 
                placeholder="00.000.000/0000-00" 
                type="text" 
                value={signupCnpj} 
                onChange={(v) => {
                  let val = v.replace(/\D/g, "");
                  if (val.length > 14) val = val.slice(0, 14);
                  val = val.replace(/^(\d{2})(\d)/, "$1.$2");
                  val = val.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
                  val = val.replace(/\.(\d{3})(\d)/, ".$1/$2");
                  val = val.replace(/(\d{4})(\d)/, "$1-$2");
                  setSignupCnpj(val);
                  
                  if (val.replace(/\D/g, "").length === 14) {
                    fetchCnpjData(val);
                  } else {
                    setCnpjError("");
                  }
                }} 
              />
              {cnpjSearching && <p className="text-[10px] font-medium text-purple-600 animate-pulse">Buscando dados na Receita Federal...</p>}
              {cnpjError && <p className="text-[10px] font-medium text-red-500">{cnpjError}</p>}
            </div>

            <Field 
              label="Razão Social / Nome Fantasia" 
              placeholder="Auto-preenchido pelo CNPJ" 
              type="text" 
              value={signupName} 
              onChange={setSignupName} 
              disabled={cnpjSearching}
            />
            <Field label="E-mail" placeholder="nome@empresa.com.br" type="email" value={signupEmail} onChange={setSignupEmail} />
            <Field label="Senha" placeholder="Mínimo 8 caracteres" type="password" value={signupPassword} onChange={setSignupPassword} onEnter={handleSignup} />
            {signupError && <Msg type="error" text={signupError} />}
            {signupSuccess && <Msg type="success" text={signupSuccess} />}
            <Btn onClick={handleSignup} loading={signupLoading} label="Criar Conta" loadingLabel="Criando conta..." />
          </div>

          {/* ─── Login ─── */}
          <div className="space-y-4 px-10 py-8" style={{ width: "50%" }}>
            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-purple-200 py-3 font-semibold text-[#260054] transition-all hover:bg-purple-50 disabled:opacity-50"
              type="button"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.02 10.02 0 0 0 2 12c0 1.61.39 3.14 1.08 4.49l3.76-2.4z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? "Conectando..." : "Entrar com Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-purple-100" />
              <span className="text-xs font-medium text-[#4a4550]">ou</span>
              <div className="h-px flex-1 bg-purple-100" />
            </div>

            <Field label="E-mail" placeholder="nome@empresa.com.br" type="email" value={loginEmail} onChange={setLoginEmail} />
            <Field label="Senha" placeholder="••••••••" type="password" value={loginPassword} onChange={setLoginPassword} onEnter={handleLogin} />
            {loginError && <Msg type="error" text={loginError} />}
            {forgotMsg && <Msg type="success" text={forgotMsg} />}
            <Btn onClick={handleLogin} loading={loginLoading} label="Entrar" loadingLabel="Entrando..." />
            <button
              className="w-full text-sm text-[#260054]/80 hover:underline disabled:opacity-50"
              type="button" disabled={forgotLoading} onClick={handleForgotPassword}
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
function Field({ label, placeholder, type, value, onChange, onEnter, disabled }: {
  label: string; placeholder: string; type: string; value: string;
  onChange: (v: string) => void; onEnter?: () => void; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[#4a4550]">{label}</label>
      <input
        className={`w-full rounded-xl border px-4 py-3 outline-none transition-all focus:ring-2 ${
          disabled ? "bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed" : "border-[#ccc3d2] focus:border-[#6b538c] focus:ring-[#dabdfe]"
        }`}
        placeholder={placeholder} type={type} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }}
      />
    </div>
  );
}

function Msg({ type, text }: { type: "error" | "success"; text: string }) {
  return (
    <p className={`rounded-lg px-4 py-3 text-sm ${type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
      {text}
    </p>
  );
}

function Btn({ onClick, loading, label, loadingLabel }: {
  onClick: () => void; loading: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      className="w-full rounded-xl bg-[#3d1a6e] py-4 font-bold text-white transition-all hover:bg-[#2D1052] hover:shadow-lg disabled:opacity-60"
      type="button" disabled={loading} onClick={onClick}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
