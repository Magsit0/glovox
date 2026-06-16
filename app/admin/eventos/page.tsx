import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireSuperadmin } from "@/lib/access";
import {
  readColumnTypes,
  readSheetGrid,
  readVenuesList,
  type SheetGrid,
  type SheetTarget,
} from "@/lib/eventos-sheet-service";
import EventosSheetEditor from "./_components/EventosSheetEditor";
import SyncBigQueryButton from "./_components/SyncBigQueryButton";

export const dynamic = "force-dynamic";

const HIDDEN_EVENTOS = ["unabaseid", "cuentaig", "property_ga4"];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

function parseTab(v?: string): SheetTarget {
  return v === "venues" ? "venues" : "eventos";
}

export default async function AdminEventosPage({ searchParams }: PageProps) {
  await requireSuperadmin();
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);

  // Sólo el fetch va en el try/catch; el JSX se arma afuera (regla de Next:
  // no construir JSX dentro de try/catch).
  let grid: SheetGrid | null = null;
  let venues: string[] = [];
  let columnTypes: Record<string, string> = {};
  let errorMsg: string | null = null;
  try {
    if (tab === "venues") {
      grid = await readSheetGrid("venues");
    } else {
      [grid, venues] = await Promise.all([
        readSheetGrid("eventos"),
        readVenuesList(),
      ]);
    }
    columnTypes = await readColumnTypes(grid.sheetTitle);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "No se pudo cargar la hoja.";
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold text-[#333333]">
        Estandarización de eventos
      </h1>
      <TabNav active={tab} />

      {errorMsg ? (
        <ErrorCard msg={errorMsg} />
      ) : grid ? (
        tab === "venues" ? (
          <>
            <SubHeader
              subtitle="Recintos estandarizados (dimensión glovox.venues). El nombre (columna venue) alimenta el desplegable de la columna VENUE en eventos."
              viewUrl={grid.viewUrl}
              action={<SyncBigQueryButton target="venues" />}
            />
            <EventosSheetEditor data={grid} target="venues" columnTypes={columnTypes} />
          </>
        ) : (
          <>
            <SubHeader
              subtitle={`Hoja maestra de la que nace glovox.categoriaEvento · pestaña “${grid.sheetTitle}”.`}
              viewUrl={grid.viewUrl}
              action={<SyncBigQueryButton target="eventos" />}
            />
            <EventosSheetEditor
              data={grid}
              target="eventos"
              hiddenColumns={HIDDEN_EVENTOS}
              venueColumn="venue"
              venues={venues}
              columnTypes={columnTypes}
            />
          </>
        )
      ) : null}
    </div>
  );
}

function TabNav({ active }: { active: SheetTarget }) {
  const tabs: { key: SheetTarget; label: string; href: string }[] = [
    { key: "eventos", label: "Eventos", href: "/admin/eventos" },
    { key: "venues", label: "Venues", href: "/admin/eventos?tab=venues" },
  ];
  return (
    <nav className="flex items-end gap-1 border-b border-[#E5E5E5]">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`-mb-px inline-flex items-center px-4 py-2 font-sans text-sm transition-colors ${
              isActive
                ? "border-b-2 border-[#9F99F8] font-medium text-[#333333]"
                : "border-b-2 border-transparent text-[#666666] hover:text-[#333333]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SubHeader({
  subtitle,
  viewUrl,
  action,
}: {
  subtitle: string;
  viewUrl: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="max-w-2xl font-sans text-sm text-[#666666]">{subtitle}</p>
      <div className="flex items-start gap-2">
        {action}
        <Link
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir en Google Sheets
        </Link>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  const is403 = /403|permission|forbidden|denied/i.test(msg);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
      <div className="flex-1 font-sans text-sm text-[#333333]">
        <p>{msg}</p>
        {is403 && (
          <p className="mt-2 text-[#666666]">
            Comparte la hoja como <strong>Editor</strong> con el email del service
            account y verifica que{" "}
            <code className="rounded bg-[#FAFAFA] px-1">EVENTOS_SHEET_ID</code>{" "}
            apunte a la hoja correcta.
          </p>
        )}
      </div>
    </div>
  );
}
