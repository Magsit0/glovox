import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getFdsGastosPorCategoria, getFdsHistorico } from "@/lib/queries/fds";
import FdsHistorico from "@/components/fds/FdsHistorico";
import FdsGastosCategoria from "@/components/fds/FdsGastosCategoria";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feria del Sanguche · Histórico",
  description: "Comparación de tickets, FF&BB, asistentes y finanzas entre ediciones de FDS.",
};

export default async function FdsHistoricoPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/fds")) redirect("/?unauthorized=1");

  let rows;
  try {
    rows = await getFdsHistorico();
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
          <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">
            {err instanceof Error ? err.message : "Error al cargar el histórico de FDS"}
          </p>
        </div>
      </Shell>
    );
  }

  // El baseline de gasto por categoría no debe tumbar el histórico si la tabla
  // de catálogo falla; se carga por separado y degrada a null.
  let gastos = null;
  try {
    gastos = await getFdsGastosPorCategoria();
  } catch {
    gastos = null;
  }

  return (
    <Shell>
      <Heading />
      {rows.length === 0 ? (
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#333333]">Sin ediciones</p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            No hay ediciones de Feria del Sanguche en el catálogo.
          </p>
        </section>
      ) : (
        <FdsHistorico rows={rows} />
      )}
      {gastos && gastos.editions.length > 0 && <FdsGastosCategoria data={gastos} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-[#FAFAFA] text-[#333333]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
        >
          <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
        </Link>
        <Link
          href="/fds"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la edición
        </Link>
      </div>
      <div>
        <p className="font-sans text-xs text-[#666666]">Feria del Sanguche · Histórico</p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          Evolución entre ediciones
        </h1>
      </div>
    </header>
  );
}
