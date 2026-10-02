"use client";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMotion } from "@/components/admin/AdminMotion";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="eq-app flex min-h-screen">
      <AdminMotion />
      <AdminSidebar />
      <div className="eq-content flex min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
