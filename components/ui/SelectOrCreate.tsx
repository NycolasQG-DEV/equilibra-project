"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (val: string) => void;
  onCreateNew: (val: string) => void;
}

/**
 * Dropdown que mostra opções existentes + botão "Criar novo".
 * Se não houver opções, abre direto o modo de criação.
 */
export function SelectOrCreate({ label, value, options, placeholder, onChange, onCreateNew }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newValue, setNewValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus no input de criação
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleCreate = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onCreateNew(trimmed);
    onChange(trimmed);
    setNewValue("");
    setCreating(false);
    setOpen(false);
  };

  const handleClick = () => {
    if (options.length === 0) {
      setCreating(true);
      setOpen(true);
    } else {
      setOpen(!open);
      setCreating(false);
    }
  };

  const labelClass = "text-xs font-bold uppercase tracking-wider text-[#4a4550]";

  return (
    <div className="space-y-1" ref={ref}>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        {/* Botão principal */}
        <button
          type="button"
          onClick={handleClick}
          className={`w-full rounded-xl border px-4 py-3 text-left text-sm outline-none transition-all flex items-center justify-between ${
            open
              ? "border-[#6b538c] ring-2 ring-[#dabdfe]"
              : "border-purple-200 hover:border-purple-300"
          }`}
        >
          <span className={value ? "text-[#260054]" : "text-[#9a8fa0]"}>
            {value || placeholder}
          </span>
          <span className="material-symbols-outlined text-lg text-[#6b538c]">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-purple-200 bg-white shadow-xl">
            {/* Opções existentes */}
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-purple-50 ${
                  value === opt ? "bg-purple-50 font-semibold text-[#3d1a6e]" : "text-[#260054]"
                }`}
              >
                {opt}
                {value === opt && (
                  <span className="material-symbols-outlined ml-2 text-sm text-[#3d1a6e]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
              </button>
            ))}

            {/* Separador */}
            {options.length > 0 && !creating && (
              <div className="border-t border-purple-100" />
            )}

            {/* Botão criar novo */}
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#3d1a6e] hover:bg-purple-50 transition-colors"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                Criar novo
              </button>
            ) : (
              <div className="border-t border-purple-100 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6b538c]">
                  {options.length === 0 ? `Crie seu primeiro ${label.toLowerCase()}` : `Novo ${label.toLowerCase()}`}
                </p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    className="flex-1 rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-[#6b538c] focus:ring-1 focus:ring-[#dabdfe]"
                    placeholder={`Ex: ${placeholder}`}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newValue.trim()}
                    className="rounded-lg bg-[#3d1a6e] px-3 py-2 text-xs font-bold text-white hover:bg-[#2D1052] disabled:opacity-40 transition-all"
                  >
                    Criar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
