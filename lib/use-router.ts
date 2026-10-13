"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { startNavigation } from "@/lib/navigation-feedback";

/**
 * Reemplazo de `useRouter` de next/navigation. Hace lo mismo, pero push/replace
 * avisan a <NavigationFeedback> para que aparezca la barra de carga y el spinner
 * sobre el filtro, fila o botón que se tocó. ESLint prohíbe el de Next fuera de
 * este archivo.
 */
export function useRouter() {
  const router = useNextRouter();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        startNavigation(args[0]);
        router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        startNavigation(args[0]);
        router.replace(...args);
      },
    }),
    [router],
  );
}
