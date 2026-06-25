import Image from "next/image";
import Link from "next/link";
import {
  NAV_BACK,
  NAV_FORWARD,
  type DashboardGroup,
  type GroupMember,
} from "@/lib/dashboard-groups";

interface Props {
  /** Grupo al que pertenece el dashboard activo. */
  group: DashboardGroup;
  /** key del dashboard activo (member.key). */
  active: string;
  /** Miembros accesibles del grupo, en orden. */
  members: GroupMember[];
}

/**
 * Clases por tema. "brutalist" reproduce exactamente la barra de la home
 * (marketing). "glovox" sigue el manual de marca (docs/STYLE_DASHBOARD.md →
 * TOP BAR): blanco, hairline #E5E5E5, font-sans, acento púrpura #9F99F8 y tabs
 * con subrayado sutil. Solo cambia el estilo visual; estructura y transiciones
 * son idénticas.
 */
const THEME = {
  brutalist: {
    nav: "sticky top-0 z-30 flex items-center gap-3 border-b-2 border-black bg-white px-4 py-2.5 sm:px-8",
    logo: "inline-flex shrink-0 items-center justify-center border-2 border-black bg-white p-1.5 transition-colors hover:bg-[#FFFF00]",
    title:
      "shrink-0 font-display text-sm font-black uppercase tracking-tight text-black transition-opacity hover:opacity-60 sm:text-base",
    tabs: "ml-auto flex items-center gap-1 overflow-x-auto",
    label:
      "whitespace-nowrap font-mono-data text-[11px] font-bold uppercase tracking-wide sm:text-xs",
    tabActive:
      "inline-flex items-center border-2 border-black bg-black px-3 py-1.5 text-[#FFFF00]",
    tabInactive:
      "inline-flex items-center border-2 border-transparent px-3 py-1.5 text-black transition-colors hover:border-black hover:bg-[#FFFF00]",
  },
  glovox: {
    nav: "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#E5E5E5] bg-white px-4 sm:px-8",
    logo: "inline-flex shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]",
    title:
      "shrink-0 font-display text-base font-bold tracking-tight text-[#333333] transition-opacity hover:opacity-70",
    tabs: "ml-auto flex items-stretch gap-1 self-stretch overflow-x-auto overflow-y-hidden",
    label: "whitespace-nowrap font-sans text-sm",
    tabActive:
      "inline-flex items-center border-b-2 border-[#9F99F8] px-3 font-medium text-[#333333]",
    tabInactive:
      "inline-flex items-center border-b-2 border-transparent px-3 text-[#666666] transition-colors hover:text-[#333333]",
  },
} as const;

/**
 * Barra persistente de un grupo. Vive en el layout de cada dashboard miembro,
 * así se mantiene fija al saltar entre ellos. Queda anclada durante las view
 * transitions (no se desplaza) para servir de referencia mientras el contenido
 * hace el slide direccional.
 */
export default function GroupNav({ group, active, members }: Props) {
  const t = THEME[group.theme];

  // Garantiza que la pestaña activa esté presente aunque no venga en la lista
  // de accesibles (caso borde: un miembro que no exige permiso explícito).
  const shown = new Set(members.map((m) => m.key));
  const tabs = group.members.filter(
    (m) => shown.has(m.key) || m.key === active,
  );
  const activeIdx = tabs.findIndex((m) => m.key === active);

  return (
    <nav style={{ viewTransitionName: group.navVt }} className={t.nav}>
      <Link
        href="/"
        aria-label="Volver al menú principal"
        transitionTypes={[NAV_BACK]}
        className={t.logo}
      >
        <Image
          src="/glovox_logo_gvx_black.svg"
          alt="Glovox"
          width={18}
          height={18}
        />
      </Link>

      <Link href={group.href} transitionTypes={[NAV_BACK]} className={t.title}>
        {group.title}
      </Link>

      <div className={t.tabs}>
        {tabs.map((m, i) => {
          const isActive = m.key === active;
          const label = <span className={t.label}>{m.label}</span>;

          if (isActive) {
            return (
              <span key={m.key} aria-current="page" className={t.tabActive}>
                {label}
              </span>
            );
          }

          // Adelante si la tab está a la derecha de la activa, atrás si está a
          // la izquierda: el slide del contenido respeta la dirección.
          const dir = i > activeIdx ? NAV_FORWARD : NAV_BACK;
          return (
            <Link
              key={m.key}
              href={m.path}
              transitionTypes={[dir]}
              className={t.tabInactive}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
