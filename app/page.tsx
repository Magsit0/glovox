import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import HomeDashboards from "@/components/HomeDashboards";
import { UserBar } from "@/app/_components/user-bar";

const ALL_SECTIONS = [
  {
    title: "CLUB GLOVOX",
    description:
      "Community sales, seller analytics, event performance, and earnings dashboards.",
    href: "/club",
    accentClass: "bg-[#0000FF]",
    accentText: "text-white",
    icon: "users",
  },
  {
    title: "MARKETING",
    description:
      "Weekly marketing meeting dashboard — paid media, sales origin, club referrals, and campaign performance.",
    href: "/marketing/weekly",
    accentClass: "bg-[#FFFF00]",
    accentText: "text-black",
    icon: "megaphone",
  },
  {
    title: "UNABASE",
    description: "Monthly closing reports and financial summaries.",
    href: "/unabase/cierre-mensual",
    accentClass: "bg-[#FF0000]",
    accentText: "text-white",
    icon: "database",
  },
  {
    title: "DONATIONS",
    description: "Mercado Pago donation income — cortesías and Yoga totals.",
    href: "/donations",
    accentClass: "bg-black",
    accentText: "text-[#FFFF00]",
    icon: "heart",
  },
  {
    title: "ONEPAGER",
    description: "Tickets and FF&BB sales overview.",
    href: "/onepager",
    accentClass: "bg-[#FF0000]",
    accentText: "text-[#FFFF00]",
    icon: "ticket",
  },
  {
    title: "FREE'S",
    description: "Free entries given out.",
    href: "/frees",
    accentClass: "bg-[#00FF00]",
    accentText: "text-black",
    icon: "gift",
  },
];

export default async function HomePage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  const visibleSections = ALL_SECTIONS.filter((s) =>
    canAccessPath(permissions, s.href),
  );

  return (
    <div className="relative">
      <UserBar email={session?.user?.email} />
      <HomeDashboards sections={visibleSections} />
    </div>
  );
}
