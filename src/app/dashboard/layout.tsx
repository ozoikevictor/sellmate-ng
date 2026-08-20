import { ProtectedRoute } from "@/components/auth";
import { DashboardShell } from "@/components/ui";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
