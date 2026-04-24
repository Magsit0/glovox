import type { BusinessRow, FilterDefinition } from "@/lib/unabase/types";

export const CLIENT_FIELD_CANDIDATES: string[] = [
  "principal_cliente",
  "principalCliente",
  "cliente_principal",
  "ClientePrincipal",
  "cliente",
  "Cliente",
  "NombreCliente",
  "nombre_cliente",
  "RazonSocialCliente",
  "CoP",
];

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    name: "area",
    label: "Área de negocio",
    getValue: (row: BusinessRow) => row.area_negocio,
    getLabel: (row: BusinessRow) => row.area_negocio,
  },
  {
    name: "categoria",
    label: "Categoría Evento 2",
    getValue: (row: BusinessRow) => row.cat2,
    getLabel: (row: BusinessRow) => row.cat2,
  },
  {
    name: "categoriaEvento1",
    label: "Categoría Evento",
    getValue: (row: BusinessRow) => row.cat1,
    getLabel: (row: BusinessRow) => row.cat1,
  },
  {
    name: "estado",
    label: "Estado negocio",
    getValue: (row: BusinessRow) => row.estado,
    getLabel: (row: BusinessRow) => row.estado,
  },
  {
    name: "evento",
    label: "Evento",
    getValue: (row: BusinessRow) => row.key,
    getLabel: (row: BusinessRow) => row.nombre,
  },
];
