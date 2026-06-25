import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

// Layout del hub del grupo FINANZAS. Solo exige sesión; el acceso fino (tener al
// menos un dashboard miembro) lo resuelve la page.
export default async function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  return <>{children}</>;
}
