import { DashboardShell } from "@/components/dashboard-shell";
import { RoleGate } from "@/components/role-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate require="platform_admin"><DashboardShell>{children}</DashboardShell></RoleGate>;
}
