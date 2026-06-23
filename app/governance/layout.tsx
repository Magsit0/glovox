import Link from "next/link";
import { requireSuperadmin } from "@/lib/access";
import GovernanceNav from "./_components/GovernanceNav";

export default async function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defensa en profundidad: el middleware ya exige sesión, y para no-superadmin
  // canAccessPath("/governance") es falso. Esto cubre cualquier bypass.
  await requireSuperadmin();

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#333333]">
      <header className="border-b border-[#E5E5E5] bg-white">
        <div className="mx-auto max-w-7xl px-8">
          <div className="flex items-center justify-between py-4">
            <Link
              href="/"
              className="font-display text-lg font-bold text-[#333333] hover:opacity-70"
            >
              Gobierno de datos
            </Link>
            <Link
              href="/"
              className="font-sans text-sm text-[#666666] hover:text-[#333333]"
            >
              ← Volver
            </Link>
          </div>
          <GovernanceNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-8 py-10">{children}</main>
    </div>
  );
}
