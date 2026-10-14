import { RoleGate } from "@/components/role-gate";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate require="user">{children}</RoleGate>;
}
