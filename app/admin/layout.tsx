import Link from "next/link";
import { requireSuperadmin } from "@/lib/access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#333333]">
      <header className="border-b border-[#E5E5E5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-display text-lg font-bold text-[#333333] hover:opacity-70"
            >
              Glovox Admin
            </Link>
            <nav className="flex items-center gap-4 font-sans text-sm text-[#666666]">
              <Link
                href="/admin/users"
                className="hover:text-[#333333]"
              >
                Usuarios
              </Link>
              <Link
                href="/admin/pendings"
                className="hover:text-[#333333]"
              >
                Pendientes
              </Link>
            </nav>
          </div>
          <Link
            href="/"
            className="font-sans text-sm text-[#666666] hover:text-[#333333]"
          >
            ← Volver
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
