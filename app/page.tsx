import { auth } from "@/lib/auth";
import type { Dashboard } from "@/lib/access";
import { HomeGrid, HomeHeader, type HomeSection, type IconKey } from "@/app/_components/home-grid";
import { UserBar } from "@/app/_components/user-bar";

const sections: (HomeSection & { dashboard: Dashboard })[] = [
  {
    dashboard: "club",
    title: "CLUB GLOVOX",
    description: "Community sales, seller analytics, event performance, and earnings dashboards.",
    href: "/club",
    icon: "users" as IconKey,
    accent: "bg-[#0000FF]",
    accentText: "text-white",
  },
  {
    dashboard: "marketing",
    title: "MARKETING",
    description: "Weekly marketing meeting dashboard — paid media, sales origin, club referrals, and campaign performance.",
    href: "/marketing/weekly",
    icon: "megaphone" as IconKey,
    accent: "bg-[#FFFF00]",
    accentText: "text-black",
  },
  {
    dashboard: "unabase",
    title: "UNABASE",
    description: "Monthly closing reports and financial summaries.",
    href: "/unabase/cierre-mensual",
    icon: "database" as IconKey,
    accent: "bg-[#FF0000]",
    accentText: "text-white",
  },
  {
    dashboard: "donations",
    title: "DONATIONS",
    description: "Mercado Pago donation income — cortesías and Yoga totals.",
    href: "/donations",
    icon: "heart" as IconKey,
    accent: "bg-black",
    accentText: "text-[#FFFF00]",
  },
  {
    dashboard: "onepager",
    title: "ONEPAGER",
    description: "Tickets and FF&BB sales overview.",
    href: "/onepager",
    icon: "ticket" as IconKey,
    accent: "bg-[#FF0000]",
    accentText: "text-[#FFFF00]",
  },
  {
    dashboard: "frees",
    title: "FREE'S",
    description: "Free entries given out.",
    href: "/frees",
    icon: "gift" as IconKey,
    accent: "bg-[#00FF00]",
    accentText: "text-black",
  },
];

export default async function HomePage() {
  const session = await auth();
  const allowed = new Set(session?.user?.dashboards ?? []);
  const visible = sections.filter((s) => allowed.has(s.dashboard));

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      <UserBar email={session?.user?.email} />
      <HomeHeader />
      {visible.length > 0 ? (
        <HomeGrid sections={visible} />
      ) : (
        <p className="mt-16 font-mono-data text-xs uppercase tracking-widest text-black">
          No tienes dashboards asignados. Contacta al administrador.
        </p>
      )}
    </main>
  );
}
