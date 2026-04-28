import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  title: "Dashboard Perú — Glovox Data",
};

export default async function PeruLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return <>{children}</>;
}
