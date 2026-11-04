import { esSuperadminVigente } from "@/lib/access";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";
import { NextResponse } from "next/server";

// Diagnóstico de permisos: devuelve DASHBOARD_PERMISSIONS completo (emails y
// accesos de todos los usuarios), así que es solo para superadmin. El proxy no
// revisa permisos en /api/*; hasta 2026-11-04 lo veía cualquier usuario con sesión.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Rol fresco de la base, no solo el de la sesión (ver esSuperadminVigente).
  if (
    session.user.role !== "superadmin" ||
    !(await esSuperadminVigente(session.user.email))
  ) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const email = session.user.email;
  const permsFromSession = session.user.permissions;
  const permsComputed = getUserPermissions(email);
  const rawEnv = process.env.DASHBOARD_PERMISSIONS ?? "(not set)";

  return NextResponse.json({
    email,
    permsFromSession,
    permsComputed,
    rawEnv,
  });
}
