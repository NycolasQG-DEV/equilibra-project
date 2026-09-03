"use client";

interface DashboardHeaderProps {
  userName: string;
  onLogout: () => void;
}

export function DashboardHeader({ userName, onLogout }: DashboardHeaderProps) {
  return (
    <header
      className="flex w-full items-center justify-between border-b border-purple-200/20 bg-[#F8F6FB] px-8 py-4 font-['Epilogue'] tracking-tight text-purple-900"
      style={{ opacity: 0 }}
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-purple-900">EQUILIBRA</span>
        <nav className="ml-8 hidden gap-6 md:flex">
          <a className="border-b-2 border-purple-900 pb-1 font-bold text-purple-900" href="#">
            Dashboard
          </a>
          <a className="text-purple-600/70 transition-colors hover:text-purple-900" href="#">
            Histórico
          </a>
          <a className="text-purple-600/70 transition-colors hover:text-purple-900" href="#">
            Recursos
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[#4a4550]">
          Olá, <strong>{userName}</strong>
        </span>
        <span className="material-symbols-outlined cursor-pointer text-purple-600/70 hover:text-purple-900">
          notifications
        </span>
        <button
          onClick={onLogout}
          className="flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-2 text-sm text-purple-700 transition-all hover:bg-purple-50 active:scale-95"
          type="button"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sair
        </button>
      </div>
    </header>
  );
}
