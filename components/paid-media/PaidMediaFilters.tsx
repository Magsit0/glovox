"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import type {
  AccountOption,
  CampaignOption,
  AdsetOption,
  IdsEnRango,
  PlataformaOption,
} from "@/lib/queries/paidMedia";
import StandardMultiFilter, {
  type StandardFilterOption,
} from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";
import {
  disponibles,
  enConflicto,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import {
  leerSeleccion,
  normalizarSeleccion,
  reemplazarSeleccion,
} from "@/lib/filters/url";
import { formatInt, plataformaLabel } from "@/components/paid-media/format";

/**
 * Catálogo COMPLETO de cada filtro (el servidor ya no lo acota ni lo trunca).
 * La selección vigente no viene por props: se lee del query de
 * `useQueryFiltros`, para que dos cambios seguidos se sumen.
 */
interface Props {
  platforms: PlataformaOption[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  adsets: AdsetOption[];
  /** Ids con datos en el rango Desde/Hasta de la URL; `null` sin rango. */
  enRango: IdsEnRango | null;
}

/** Un adset con toda su cadena: el ítem sobre el que se encadenan los filtros. */
type Item = {
  plataforma: string;
  account: string;
  campaign: string;
  adset: string;
  objective: string;
};

/**
 * Facetas encadenadas (lib/filters/facetas.ts). La key es el param de la URL.
 *
 * Plataforma → Cuenta → Campaña → Adset es una jerarquía de un solo sentido:
 * el padre acota las opciones del hijo, pero elegir un hijo no le esconde
 * opciones al padre (`ignora`), igual que la cascada de antes. Objetivo es un
 * atributo de la campaña: se acota con Plataforma y Cuenta y acota a Cuenta,
 * Campaña y Adset. Plataforma (tres valores) muestra las tres salvo que el
 * rango de fechas deje alguna sin datos (ver `facetaRango`).
 *
 * Ningún filtro modifica a otro: una selección que deja de calzar sigue
 * marcada (atenuada) y, si la combinación no deja datos, el aviso ofrece
 * limpiar el filtro que choca.
 */
const FACETAS: Faceta<Item>[] = [
  {
    key: "plataforma",
    valores: (i) => i.plataforma,
    ignora: ["account", "campaign", "adset", "objective"],
  },
  { key: "account", valores: (i) => i.account, ignora: ["campaign", "adset"] },
  { key: "campaign", valores: (i) => i.campaign, ignora: ["adset"] },
  { key: "adset", valores: (i) => i.adset },
  { key: "objective", valores: (i) => i.objective, ignora: ["campaign", "adset"] },
];

const PARAMS = FACETAS.map((f) => f.key);

/**
 * El rango Desde/Hasta como faceta del encadenamiento: un ítem "calza" si tuvo
 * datos en el rango. Así acota las opciones de todos los filtros a lo que tiene
 * datos en esas fechas y entra en el aviso si la combinación queda vacía. No es
 * un param: limpiarlo borra `from` y `to` juntos (son un solo filtro).
 */
const RANGO = "rango";
const EN_RANGO = "si";

function facetaRango(enRango: IdsEnRango): Faceta<Item> {
  const cuentas = new Set(enRango.accounts);
  const campanias = new Set(enRango.campaigns);
  const adsets = new Set(enRango.adsets);
  return {
    key: RANGO,
    valores: (i) => {
      const tiene = i.adset
        ? adsets.has(i.adset)
        : i.campaign
          ? campanias.has(i.campaign)
          : cuentas.has(i.account);
      return tiene ? EN_RANGO : null;
    },
  };
}

const LABEL: Record<string, string> = {
  plataforma: "Plataforma",
  account: "Cuenta",
  campaign: "Campaña",
  adset: "Adset",
  objective: "Objetivo",
  [RANGO]: "Fechas",
};

const INPUT_CLS =
  "rounded-lg border border-[var(--divider)] bg-[var(--surface)] py-2 px-3 font-sans text-sm text-[var(--ink)] transition-colors hover:border-[var(--ink)] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

/**
 * Un ítem por adset con su campaña, cuenta, objetivo y plataforma. Una campaña
 * sin adsets, o una cuenta sin campañas, entra igual como ítem propio: si no,
 * elegirla se leería como una combinación sin datos.
 */
function construirItems(
  accounts: AccountOption[],
  campaigns: CampaignOption[],
  adsets: AdsetOption[],
): Item[] {
  const cuentaPorId = new Map(accounts.map((a) => [a.accountId, a]));
  const campaniaPorId = new Map(campaigns.map((c) => [c.campaignId, c]));
  const plataformaDe = (accountId: string) => cuentaPorId.get(accountId)?.plataforma ?? "";

  const items: Item[] = [];
  const campaniasConAdset = new Set<string>();
  for (const a of adsets) {
    const c = campaniaPorId.get(a.campaignId);
    campaniasConAdset.add(a.campaignId);
    items.push({
      plataforma: c ? plataformaDe(c.accountId) : "",
      account: c?.accountId ?? "",
      campaign: a.campaignId,
      adset: a.adsetId,
      objective: c?.objective ?? "",
    });
  }
  const cuentasConCampania = new Set<string>();
  for (const c of campaigns) {
    cuentasConCampania.add(c.accountId);
    if (campaniasConAdset.has(c.campaignId)) continue;
    items.push({
      plataforma: plataformaDe(c.accountId),
      account: c.accountId,
      campaign: c.campaignId,
      adset: "",
      objective: c.objective,
    });
  }
  for (const a of accounts) {
    if (cuentasConCampania.has(a.accountId)) continue;
    items.push({
      plataforma: a.plataforma,
      account: a.accountId,
      campaign: "",
      adset: "",
      objective: "",
    });
  }
  return items;
}

export default function PaidMediaFilters({
  platforms,
  accounts,
  campaigns,
  adsets,
  enRango,
}: Props) {
  // Query vigente: el último cambio pedido aunque la navegación (que espera a
  // BigQuery) no haya terminado, para que dos cambios seguidos se sumen.
  const { search, navegar } = useQueryFiltros("/paid-media");

  /** Selección de cada filtro, leída de la URL. Vacía = "Todos". */
  const sel = useMemo(() => {
    const sp = new URLSearchParams(search);
    const out: Record<string, Set<string>> = {};
    for (const p of PARAMS) out[p] = leerSeleccion(sp, p);
    return out;
  }, [search]);
  const { from, to } = useMemo(() => {
    const sp = new URLSearchParams(search);
    return { from: sp.get("from") ?? "", to: sp.get("to") ?? "" };
  }, [search]);

  const items = useMemo(
    () => construirItems(accounts, campaigns, adsets),
    [accounts, campaigns, adsets],
  );

  /** Universo completo de cada filtro, en el orden del dropdown. */
  const universo = useMemo<Record<string, string[]>>(() => {
    const objetivos = new Set<string>();
    for (const c of campaigns) if (c.objective) objetivos.add(c.objective);
    return {
      plataforma: platforms.map((p) => p.plataforma),
      account: accounts.map((a) => a.accountId),
      campaign: campaigns.map((c) => c.campaignId),
      adset: adsets.map((a) => a.adsetId),
      objective: [...objetivos].sort((a, b) => a.localeCompare(b, "es")),
    };
  }, [platforms, accounts, campaigns, adsets]);

  /** Etiqueta y metadato de cada valor. Un id que no está en el catálogo
   *  (link viejo, id escrito a mano) se muestra con el id. */
  const describir = useMemo(() => {
    const plataformaRows = new Map(platforms.map((p) => [p.plataforma as string, p.rows]));
    const cuenta = new Map(accounts.map((a) => [a.accountId, a]));
    const campania = new Map(campaigns.map((c) => [c.campaignId, c]));
    const adset = new Map(adsets.map((a) => [a.adsetId, a]));
    return (param: string, v: string): StandardFilterOption => {
      switch (param) {
        case "plataforma": {
          const rows = plataformaRows.get(v);
          return {
            value: v,
            label:
              rows === undefined
                ? plataformaLabel(v)
                : `${plataformaLabel(v)} · ${formatInt(rows)}`,
          };
        }
        case "account": {
          // La moneda de la cuenta es un metadato del selector: ya no filtra
          // nada (todo se agrega en dólares), pero sigue siendo el dato que
          // permite saber contra qué factura se reconcilia cada cuenta.
          const a = cuenta.get(v);
          if (!a) return { value: v, label: v };
          return {
            value: v,
            label: a.accountName || v,
            meta: a.currency
              ? `${plataformaLabel(a.plataforma)} · ${a.currency}`
              : plataformaLabel(a.plataforma),
          };
        }
        case "campaign": {
          const c = campania.get(v);
          return { value: v, label: c?.campaignName || v, meta: c?.objective || undefined };
        }
        case "adset":
          return { value: v, label: adset.get(v)?.adsetName || v };
        default:
          return { value: v, label: v };
      }
    };
  }, [platforms, accounts, campaigns, adsets]);

  // El rango encadena solo si las props traen el del query vigente: mientras
  // la navegación no termina son las del rango anterior y acotarían con datos
  // viejos. Sin rango vigente, las fechas no acotan ni entran en el aviso.
  const rangoVigente =
    (from || to) && enRango && enRango.from === from && enRango.to === to ? enRango : null;
  const facetas = useMemo(
    () => (rangoVigente ? [...FACETAS, facetaRango(rangoVigente)] : FACETAS),
    [rangoVigente],
  );
  const selConRango = useMemo(
    () => (rangoVigente ? { ...sel, [RANGO]: new Set([EN_RANGO]) } : sel),
    [sel, rangoVigente],
  );

  /** Valores compatibles de cada filtro con lo elegido en los otros. */
  const disp = useMemo(
    () => disponibles(items, facetas, selConRango),
    [items, facetas, selConRango],
  );

  /**
   * Opciones de cada dropdown: las compatibles con los otros filtros más las
   * ya seleccionadas aunque hayan quedado incompatibles (se ven atenuadas vía
   * `available` y se pueden desmarcar).
   */
  const options = useMemo(() => {
    const out: Record<string, StandardFilterOption[]> = {};
    for (const p of PARAMS) {
      out[p] = opcionesVisibles(universo[p], disp[p], sel[p]).map((v) => describir(p, v));
    }
    return out;
  }, [universo, disp, sel, describir]);

  /** Filtros que chocan cuando la combinación no deja ningún adset. */
  const conflictos = useMemo(
    () =>
      enConflicto(items, facetas, selConRango).map((key) => ({
        key,
        label: LABEL[key] ?? key,
      })),
    [items, facetas, selConRango],
  );

  /**
   * Escribe SOLO la selección de este filtro (vacía = borra el param). Los
   * demás no se tocan aunque queden incompatibles. Marcar el universo entero
   * se guarda como "Todos" (normalizarSeleccion).
   */
  function setFaceta(param: string, next: Iterable<string>) {
    navegar(reemplazarSeleccion(search, param, normalizarSeleccion(next, universo[param] ?? [])));
  }

  /** Escribe solo un param de valor único (las fechas). */
  function setParam(param: string, value: string) {
    const params = new URLSearchParams(search);
    if (value) params.set(param, value);
    else params.delete(param);
    navegar(params.toString());
  }

  /** "Limpiar Fechas" del aviso: el rango es un solo filtro (from + to). */
  function limpiarFechas() {
    const params = new URLSearchParams(search);
    params.delete("from");
    params.delete("to");
    navegar(params.toString());
  }

  /** "Limpiar filtros": vuelve al estado por defecto (sin filtros). Conserva
   *  el tab, para no rebotar de Detalle a Overall, y la moneda de despliegue,
   *  que no es un filtro (se elige en el switch de arriba). */
  function limpiarTodo() {
    const actual = new URLSearchParams(search);
    const next = new URLSearchParams();
    for (const key of ["tab", "moneda"]) {
      const v = actual.get(key);
      if (v) next.set(key, v);
    }
    navegar(next.toString());
  }

  const hasActiveFilters = PARAMS.some((p) => sel[p].size > 0) || Boolean(from) || Boolean(to);

  // Campaña y Adset solo se deshabilitan si no hay nada que ofrecer NI nada
  // seleccionado: un filtro con selección siempre se puede abrir y limpiar.
  const sinCampanias = options.campaign.length === 0 && sel.campaign.size === 0;
  const sinAdsets = options.adset.length === 0 && sel.adset.size === 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <StandardMultiFilter
          label={LABEL.plataforma}
          options={options.plataforma}
          available={disp.plataforma}
          selected={sel.plataforma}
          onChange={(next) => setFaceta("plataforma", next)}
          allLabel="Todas"
          searchPlaceholder="Buscar plataforma..."
        />

        <StandardMultiFilter
          label={LABEL.account}
          options={options.account}
          available={disp.account}
          selected={sel.account}
          onChange={(next) => setFaceta("account", next)}
          allLabel="Todas las cuentas"
          searchPlaceholder="Buscar cuenta..."
        />

        <StandardMultiFilter
          label={LABEL.campaign}
          options={options.campaign}
          available={disp.campaign}
          selected={sel.campaign}
          onChange={(next) => setFaceta("campaign", next)}
          allLabel={sinCampanias ? "Sin campañas" : "Todas las campañas"}
          searchPlaceholder="Buscar campaña..."
          disabled={sinCampanias}
        />

        <StandardMultiFilter
          label={LABEL.adset}
          options={options.adset}
          available={disp.adset}
          selected={sel.adset}
          onChange={(next) => setFaceta("adset", next)}
          allLabel={sinAdsets ? "Sin adsets" : "Todos los adsets"}
          searchPlaceholder="Buscar adset..."
          disabled={sinAdsets}
        />

        <StandardMultiFilter
          label={LABEL.objective}
          options={options.objective}
          available={disp.objective}
          selected={sel.objective}
          onChange={(next) => setFaceta("objective", next)}
          allLabel="Todos"
          searchPlaceholder="Buscar objetivo..."
        />

        {/* Rango de fechas */}
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[var(--ink-muted)]">Desde</span>
          <input
            type="date"
            className={INPUT_CLS}
            value={from}
            onChange={(e) => setParam("from", e.target.value)}
            aria-label="Fecha desde"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[var(--ink-muted)]">Hasta</span>
          <input
            type="date"
            className={INPUT_CLS}
            value={to}
            onChange={(e) => setParam("to", e.target.value)}
            aria-label="Fecha hasta"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={limpiarTodo}
            className="flex items-center gap-1 px-2 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpiar filtros
          </button>
        )}
      </div>

      <FilterConflictNotice
        conflicts={conflictos}
        onClear={(key) => (key === RANGO ? limpiarFechas() : setFaceta(key, []))}
      />
    </section>
  );
}
