"use client";

import { Fragment, useState } from "react";
import {
  Delta,
  Note,
  SlideTitle,
  SubTitle,
  Table,
  Td,
  Th,
  TramosCalor,
} from "@/components/cierres/deck/primitives";
import type { CMP_DIAS, DiaCmp, POR_DIA } from "@/lib/cierres/fds-26";

type Dia = (typeof CMP_DIAS)[number];
type TramoKey = "antes" | "semanas1a3" | "ultimaSemana" | "dia";

/**
 * Cuerpo de la lámina de comparación con la FDS 25, con un selector para ver
 * los tres días juntos o uno por uno. Arranca en «Los 3 días», que es lo que
 * sale en el PDF; el selector no se imprime.
 */
export default function ComparacionPorDia({
  dias,
  porDia,
  tramos,
}: {
  dias: readonly Dia[];
  porDia: typeof POR_DIA;
  tramos: readonly { key: TramoKey; label: string; color: string }[];
}) {
  const [key, setKey] = useState<DiaCmp>("todos");
  const d = dias.find((x) => x.key === key) ?? dias[0];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <SlideTitle>{d.titulo}</SlideTitle>
        <div
          role="radiogroup"
          aria-label="Día de la feria"
          className="inline-flex shrink-0 rounded-full border border-[var(--divider)] bg-[var(--surface)] p-0.5 print:hidden"
        >
          {dias.map((x) => {
            const activo = x.key === key;
            return (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setKey(x.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activo
                    ? "bg-[#9F99F8] text-white"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,10fr)_minmax(0,9fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SubTitle>{key === "todos" ? "Resultado" : `Resultado del ${d.label.toLowerCase()}`}</SubTitle>
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>Indicador</Th>
                <Th right>FDS 24</Th>
                <Th right>FDS 25</Th>
                <Th right>FDS 26</Th>
                <Th right>26 contra 25</Th>
              </tr>
            </thead>
            <tbody>
              {d.filas.map((r, i, arr) => (
                <Fragment key={r.indicador}>
                  {r.grupo !== arr[i - 1]?.grupo && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-b border-[var(--divider)] bg-[var(--surface-sunken)] px-3 pt-2 pb-1 text-xs font-semibold text-[var(--ink-muted)]"
                      >
                        {r.grupo}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <Td>{r.indicador}</Td>
                    <Td right className="text-[var(--ink-subtle)]">{r.f24}</Td>
                    <Td right className="text-[var(--ink-muted)]">{r.f25}</Td>
                    <Td right className="font-semibold">{r.f26}</Td>
                    <Td right className="whitespace-nowrap">
                      <Delta tone={r.cambio.tone}>{r.cambio.texto}</Delta>
                    </Td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </Table>
          {key !== "todos" && (
            <Note>La pauta en Meta y la salida a la venta no se separan por día: están en «Los 3 días».</Note>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <SubTitle>Cuándo compraron</SubTitle>
          <TramosCalor tramos={tramos} filas={d.tramos} />
          <Note>{d.nota}</Note>
          {key === "todos" && (
            <>
              <SubTitle>Por día</SubTitle>
              <Table className="text-xs">
                <thead>
                  <tr>
                    <Th>Día</Th>
                    <Th right>Pagaron · 24 · 25 → 26</Th>
                    <Th right>Entraron · 24 · 25 → 26</Th>
                  </tr>
                </thead>
                <tbody>
                  {porDia.map((p) => (
                    <tr key={p.dia}>
                      <Td>{p.dia}</Td>
                      {[p.pagaron, p.entraron].map(([a, b, c], i) => (
                        <Td key={i} right className="whitespace-nowrap">
                          <span className="text-[var(--ink-subtle)]">{a} ·</span>{" "}
                          <span className="text-[var(--ink-muted)]">{b} →</span>{" "}
                          <b className="font-semibold">{c}</b>
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
