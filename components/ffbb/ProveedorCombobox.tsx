"use client";

import { createProveedorAction } from "@/app/ffbb/actions";
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
 * Combobox del catálogo de proveedores FF&BB. Permite agregar uno nuevo
 * inline (solo necesita el nombre).
 */
export default function ProveedorCombobox({
  options,
  value,
  onChange,
  placeholder = "Buscar proveedor…",
  id,
  ariaLabel,
}: Props) {
  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Buscar proveedor…"
      id={id}
      ariaLabel={ariaLabel}
      createLabel={(q) => `Agregar "${q}" como nuevo proveedor`}
      onCreate={async (nombre) => {
        const res = await createProveedorAction(nombre);
        return res.ok ? res.data?.nombre ?? null : null;
      }}
    />
  );
}
