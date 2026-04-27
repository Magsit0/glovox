import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "(no email)";
  const permsFromSession = session?.user?.permissions;
  const permsComputed = getUserPermissions(email);
  const rawEnv = process.env.DASHBOARD_PERMISSIONS ?? "(not set)";

  return NextResponse.json({
    email,
    permsFromSession,
    permsComputed,
    rawEnv,
  });
}
