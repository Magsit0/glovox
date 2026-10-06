// Checklist estático de lo que no puede faltar en una Feria del Sanguche.
// Para sumar o quitar un punto, edita este arreglo.
const ESENCIALES = [
  "Mercaditos",
  "Stands de comida",
  "Foodtrucks de comida",
  "Juegos inflables",
  "Zona niños",
  "Fundaciones / muebles",
  "Accesos",
  "Activaciones de marca",
  "Barras de cócteles",
  "Barras de cerveza",
  "Baños",
  "Escenario",
] as const;

export default function FdsEsenciales() {
  return (
    <section className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
          Esenciales de una Feria del Sanguche
        </h2>
        <p className="mt-1 font-sans text-sm text-[var(--ink-muted)]">
          Lo que no puede faltar al planificar una edición.
        </p>
      </header>
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 font-sans text-sm text-[var(--ink)] sm:grid-cols-2 lg:grid-cols-4">
        {ESENCIALES.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
