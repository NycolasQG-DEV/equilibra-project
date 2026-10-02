"use client";

import { AdminMotion } from "@/components/admin/AdminMotion";

export default function ColaboradorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminMotion />
      {children}
    </>
  );
}
