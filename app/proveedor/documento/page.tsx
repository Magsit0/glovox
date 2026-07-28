import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSearch } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getDocumentoDetalle } from "@/lib/queries/proveedor";
import DocDetalle from "@/components/proveedor/DocDetalle";
import DocSearchBox from "@/components/proveedor/DocSearchBox";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ doc?: string }>;
}

export default async function DocumentoPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  // Hereda el permiso de /proveedor (canAccessPath matchea por prefijo).
  if (!canAccessPath(permissions, "/proveedor")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const doc = params.doc?.trim() || undefined;

  let rows;
  let error;
  if (doc) {
    try {
      rows = await getDocumentoDetalle(doc);
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Error al buscar el documento.";
    }
  }

  return (
    <Shell>
      <Heading />
      <DocSearchBox initial={doc ?? ""} />
      {error && <ErrorView message={error} />}
      {doc && !error && rows && <DocDetalle nroDoc={doc} rows={rows} />}
      {!doc && <Hint />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/proveedor"
        className="inline-flex w-fit items-center gap-1.5 font-sans text-sm text-[#666666] transition-colors hover:text-[#333333]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a proveedores
      </Link>
      <div className="mt-1 flex items-center gap-2">
        <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
        <p className="font-sans text-xs text-[#666666]">Proveedor · Documento</p>
      </div>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Buscar por documento
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Busca un gasto por su Nº DOC (folio del documento tributario). Muestra las
        líneas del documento y, cuando corresponde, el proveedor real detrás de un
        documento re-facturado (ej. Espacio Riesco → Provetec).
      </p>
    </header>
  );
}

function Hint() {
  return (
    <section className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#E5E5E5] bg-white px-6 py-12 text-center">
      <FileSearch className="h-6 w-6 text-[#999999]" />
      <p className="font-sans text-sm text-[#666666]">
        Escribe un Nº DOC arriba para ver ese documento.
      </p>
      <p className="font-sans text-xs text-[#999999]">
        Es el folio del documento tributario (el número de tu planilla), no el
        folio de la OC.
      </p>
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
      <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
      <p className="flex-1 font-sans text-sm text-[#333333]">{message}</p>
    </div>
  );
}
