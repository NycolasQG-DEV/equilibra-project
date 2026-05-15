export function SiteFooter() {
  return (
    <footer
      className="reveal flex w-full flex-col items-center justify-between gap-4 border-t border-purple-100 bg-[#F8F6FB] px-8 py-12 font-['Epilogue'] text-xs md:flex-row"
      style={{ opacity: 0 }}
      data-delay="0"
    >
      <div className="flex flex-col gap-2">
        <span className="text-lg font-bold text-purple-900">EQUILIBRA</span>
        <p className="text-purple-500">
          © 2025 EQUILIBRA. Clinical Rigor, Empathetic Support.
        </p>
      </div>
    </footer>
  );
}
