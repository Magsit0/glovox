"use client";

import { createInsumoCatalogoAction } from "@/app/ffbb/actions";
import Combobox from "./Combobox";

interface Props {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

/**
 * Combobox de insumos del catálogo FF&BB. Permite agregar uno nuevo inline
 * (con solo el nombre — el resto de columnas como grupo/marca/mL se completan
 * después en una vista de admin si hace falta).
 */
export default function InsumoCombobox({
  options,
  value,
  onChange,
  placeholder = "Buscar insumo…",
  id,
  ariaLabel,
}: Props) {
  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar insumo…"
      unknownBadge="no listado"
      id={id}
      ariaLabel={ariaLabel}
      createLabel={(q) => `Agregar "${q}" como nuevo insumo`}
      onCreate={async (nombre) => {
        const res = await createInsumoCatalogoAction({ nombre });
        return res.ok ? res.data?.nombre ?? null : null;
      }}
    />
  );
}
