import { UserRole } from "@/types/database";

export const ROLE_ROUTES: Record<UserRole, string> = {
  default: "/colaborador",
  admin: "/admin",
  dev: "/dev",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  default: "Colaborador",
  admin: "Administrador",
  dev: "Desenvolvedor",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  default: "bg-purple-100 text-purple-700",
  admin: "bg-amber-100 text-amber-700",
  dev: "bg-sky-100 text-sky-700",
};
