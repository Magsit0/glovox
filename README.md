# glovox

glovox projects

## Estándar de filtros (todos los dashboards)

**Todo filtro que se cree en cualquier dashboard DEBE tener los tres elementos:**

1. **Buscador** — un input que filtra las opciones por texto (sub-string, case-insensitive). Indispensable cuando las opciones pueden ser muchas (categorías, productos, clientes, etc.).
2. **Multiselector** — selección múltiple con checkboxes; cada opción se marca/desmarca de forma independiente. Convención: conjunto vacío = "Todos" (sin filtro aplicado).
3. **Limpiador** — un botón "Limpiar" que vacía la selección de un solo click.

### Cómo cumplirlo

Reutilizá el componente estándar [`components/onepager/MultiFilter.tsx`](components/onepager/MultiFilter.tsx), que ya implementa los tres elementos con el estilo brutalista del one-pager (bordes negros, acento `#FFFF00`, `font-mono-data`). Uso:

```tsx
import MultiFilter from "@/components/onepager/MultiFilter";

const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

<MultiFilter
  label="Categoría"
  options={opcionesUnicasYOrdenadas}
  selected={seleccion}
  onChange={setSeleccion}
  searchPlaceholder="Buscar categoría…" // opcional
/>;
```

- Para filtros **en cascada** (ej. Producto acotado por Categoría seleccionada), derivá las `options` del segundo filtro a partir de la selección del primero. Ver [`FfbbDetalleTable.tsx`](components/onepager/FfbbDetalleTable.tsx) y [`FfbbEvolucionChart.tsx`](components/onepager/FfbbEvolucionChart.tsx) como referencia.
- Si un panel necesita un look distinto al dropdown (ej. chips siempre visibles para 2-3 opciones fijas), igual debe cumplir los tres elementos; pero por defecto preferí `MultiFilter` para mantener un estándar único.

El resto de convenciones visuales del dashboard viven en [`docs/STYLE_DASHBOARD.md`](docs/STYLE_DASHBOARD.md).
