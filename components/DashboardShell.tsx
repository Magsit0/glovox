import { auth } from "@/lib/auth";
import { logout } from "@/lib/actions";
import DashboardLayout from "./DashboardLayout";

export default async function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <DashboardLayout userName={session?.user?.name ?? "Admin"} onSignOut={logout}>
      {children}
    </DashboardLayout>
  );
}
