"use client";

interface SiteHeaderProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function SiteHeader({ onLogin, onSignup }: SiteHeaderProps) {
  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex w-full items-center justify-between border-b border-purple-200/20 bg-[#F8F6FB] px-8 py-4"
      style={{ opacity: 0 }}
    >
      <span className="font-['Epilogue'] text-2xl font-bold tracking-tight text-purple-900">
        EQUILIBRA
      </span>
      <div className="flex items-center gap-4">
        <button
          className="px-6 py-2 font-semibold text-purple-900 transition-opacity hover:opacity-70"
          onClick={onLogin}
          type="button"
        >
          Entrar
        </button>
        <button
          className="rounded-lg bg-[#3d1a6e] px-6 py-2 font-semibold text-white shadow-md transition-all hover:bg-[#2D1052]"
          onClick={onSignup}
          type="button"
        >
          Começar Grátis
        </button>
      </div>
    </header>
  );
}
