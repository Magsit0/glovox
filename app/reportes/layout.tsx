import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return <>{children}</>;
}
