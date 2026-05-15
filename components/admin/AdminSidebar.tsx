"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/pesquisas", label: "Pesquisas", icon: "assignment" },
  { href: "/admin/usuarios", label: "Usuários", icon: "group" },
  { href: "/admin/relatorios", label: "Relatórios NR-1", icon: "bar_chart" },
  { href: "/admin/chat-ia", label: "Chat IA", icon: "smart_toy" },
  { href: "/admin/assinatura", label: "Assinatura", icon: "credit_card" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`flex flex-shrink-0 flex-col bg-gradient-to-b from-[#1a0740] to-[#2d1052] text-white transition-all duration-300 ${open ? "w-64" : "w-20"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
          <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
        </div>
        {open && (
          <div className="overflow-hidden">
            <span className="block text-base font-bold leading-tight">EQUILIBRA</span>
            <span className="block text-xs text-white/50">Painel Admin</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                active ? "bg-white/15 text-white shadow-inner" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
              {open && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="m-3 flex items-center justify-center rounded-xl border border-white/10 py-3 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
        type="button"
        title={open ? "Recolher menu" : "Expandir menu"}
      >
        <span className="material-symbols-outlined text-xl">
          {open ? "chevron_left" : "chevron_right"}
        </span>
      </button>
    </aside>
  );
}
