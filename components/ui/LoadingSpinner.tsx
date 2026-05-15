export function LoadingSpinner({ message = "Carregando..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6FB]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-[#3d1a6e]" />
        <p className="text-sm text-[#4a4550]">{message}</p>
      </div>
    </div>
  );
}
