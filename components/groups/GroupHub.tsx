import Link from "next/link";
import { ViewTransition } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  NAV_BACK,
  NAV_FORWARD,
  type DashboardGroup,
  type GroupMember,
} from "@/lib/dashboard-groups";
import { GROUP_ICON_MAP, FALLBACK_GROUP_ICON } from "@/components/groups/groupIcons";

interface Props {
  group: DashboardGroup;
  /** Miembros accesibles del grupo, en orden. */
  members: GroupMember[];
}

/**
 * Clases por tema. "brutalist" reproduce exactamente el hub de la home
 * (marketing). "glovox" sigue el manual de marca (docs/STYLE_DASHBOARD.md):
 * canvas #FAFAFA, cards `rounded-lg border-[#E5E5E5]`, font-sans/display,
 * botones suaves y acento púrpura. Solo cambia el estilo; estructura y
 * transiciones son idénticas.
 */
const THEME = {
  brutalist: {
    main: "min-h-screen bg-white px-6 py-12 sm:px-10",
    backLink:
      "inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-2 font-mono-data text-xs font-bold uppercase tracking-wide text-black shadow-[3px_3px_0px_#000] transition-colors hover:bg-[#FFFF00]",
    heroTile:
      "inline-flex shrink-0 items-center justify-center border-4 border-black p-4 shadow-[4px_4px_0px_#000]",
    heroTitle:
      "font-display text-5xl font-black uppercase leading-none tracking-tight text-black sm:text-6xl",
    heroDesc:
      "max-w-xl font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black/70",
    card: "group flex h-full flex-col border-4 border-black bg-white p-6 shadow-[4px_4px_0px_#000] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000]",
    cardTile:
      "inline-flex shrink-0 items-center justify-center border-2 border-black p-3",
    cardTitle:
      "min-w-0 font-display text-xl font-black uppercase leading-none tracking-tight text-black",
    cardDesc:
      "grow text-justify font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black",
    cardCta:
      "mt-5 inline-flex w-fit items-center gap-2 border-2 border-black bg-[#FFFF00] px-4 py-2 font-mono-data text-xs font-bold uppercase text-black transition-colors group-hover:bg-black group-hover:text-[#FFFF00]",
  },
  glovox: {
    main: "min-h-screen bg-[#FAFAFA] px-6 py-10 sm:px-8",
    backLink:
      "inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]",
    heroTile:
      "inline-flex shrink-0 items-center justify-center rounded-xl p-4 shadow-sm",
    heroTitle:
      "font-display text-5xl font-bold leading-none tracking-tight text-[#333333] sm:text-6xl",
    heroDesc: "max-w-xl font-sans text-sm leading-relaxed text-[#666666]",
    card: "group flex h-full flex-col rounded-lg border border-[#E5E5E5] bg-white p-6 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md",
    cardTile: "inline-flex shrink-0 items-center justify-center rounded-lg p-3",
    cardTitle:
      "min-w-0 font-display text-lg font-bold leading-none tracking-tight text-[#333333]",
    cardDesc: "grow font-sans text-sm leading-relaxed text-[#666666]",
    cardCta:
      "mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]",
  },
} as const;

/**
 * Hub de un grupo. Se llega desde la card del grupo en la home (morph del hero,
 * compartido por `group.heroVt`) y desde acá se entra a cada dashboard miembro.
 * El control de acceso (auth + redirect si no hay miembros) lo hace la page que
 * renderiza este componente.
 */
export default function GroupHub({ group, members }: Props) {
  const t = THEME[group.theme];
  const GroupIcon = GROUP_ICON_MAP[group.icon] ?? FALLBACK_GROUP_ICON;

  return (
    <main className={t.main}>
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div>
          <Link
            href="/"
            transitionTypes={[NAV_BACK]}
            aria-label="Volver al menú principal"
            className={t.backLink}
          >
            <ArrowLeft size={14} strokeWidth={2.5} />
            Menú principal
          </Link>
        </div>

        {/* Hero — hace morph desde/hacia la card del grupo en la home. Solo
            envuelve icono + título para que calce con la card de la home. */}
        <header className="flex flex-col gap-4">
          <ViewTransition name={group.heroVt} share="morph" default="none">
            <div className="flex items-center gap-5">
              <div className={`${t.heroTile} ${group.accentClass}`}>
                <GroupIcon size={36} className={group.accentText} strokeWidth={2.5} />
              </div>
              <h1 className={t.heroTitle}>{group.title}</h1>
            </div>
          </ViewTransition>
          <p className={t.heroDesc}>{group.description}</p>
        </header>

        {/* Dashboards del grupo */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const Icon = GROUP_ICON_MAP[m.icon] ?? FALLBACK_GROUP_ICON;
            return (
              <Link
                key={m.key}
                href={m.path}
                transitionTypes={[NAV_FORWARD]}
                className={t.card}
              >
                <div className="mb-4 flex items-center gap-4">
                  <div className={`${t.cardTile} ${m.accentClass}`}>
                    <Icon size={24} className={m.accentText} strokeWidth={2.5} />
                  </div>
                  <h2 className={t.cardTitle}>{m.label}</h2>
                </div>
                <p className={t.cardDesc}>{m.description}</p>
                <div className={t.cardCta}>
                  Abrir
                  <ArrowRight size={14} strokeWidth={2.5} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
