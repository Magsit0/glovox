import { ViewTransition } from "react";
import {
  NAV_BACK,
  NAV_FORWARD,
  type DashboardGroup,
} from "@/lib/dashboard-groups";

/**
 * Envuelve el contenido de un dashboard de un grupo para que haga el slide
 * direccional al navegar (adelante/atrás) entre el hub y los dashboards, y
 * entre dashboards hermanos. Comparte `name` (group.contentVt) entre rutas para
 * que el contenido viejo y el nuevo se animen como par. `default: "none"` evita
 * animar en navegaciones sin tipo (carga inicial, back del navegador).
 */
export default function GroupContent({
  group,
  children,
}: {
  group: DashboardGroup;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition
      name={group.contentVt}
      default="none"
      enter={{ [NAV_FORWARD]: NAV_FORWARD, [NAV_BACK]: NAV_BACK, default: "none" }}
      exit={{ [NAV_FORWARD]: NAV_FORWARD, [NAV_BACK]: NAV_BACK, default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}
