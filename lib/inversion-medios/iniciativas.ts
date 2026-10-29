/**
 * Iniciativas de paid media — módulo CLIENT-SAFE (sin imports de servidor).
 *
 * Una iniciativa es un frente de inversión SIN fecha de evento (Club Glovox,
 * Now Mag…). Comparte con los eventos el plan diario (misma tabla, misma
 * edición en el drill, `evento_id` = id de la iniciativa) pero no el gasto
 * real: el suyo son las campañas SIN evento que el equipo le asigna a mano,
 * arrastrándolas desde "No atribuido". El techo es la suma de su plan.
 */

/** INI + 3 dígitos. Cumple EVENTO_RE de la ruta y nunca lo extrae el mart. */
export const INICIATIVA_RE = /^INI\d{3}$/;

export function esIniciativaId(id: string): boolean {
  return INICIATIVA_RE.test(id);
}

/** Identidad de una campaña de ads: el nombre cambia, el id no. */
export function campanaKey(plataforma: string, campaignId: string): string {
  return `${plataforma}|${campaignId}`;
}

export type CampanaAsignada = {
  plataforma: string;
  campaignId: string;
  /** Nombre al momento de asignar (el vigente sale del mart). */
  campaignName: string;
  iniciativaId: string;
  /** La asignó una regla (no se arrastró a mano). Vuelve a "No atribuido" solo
   *  si se borra la regla; a mano se puede mover a OTRA iniciativa. */
  porRegla?: boolean;
  /** Iniciativa cuya regla calza con la campaña, aunque hoy esté asignada a mano
   *  a otra: quitarle la asignación la devuelve ahí, nunca a "No atribuido". */
  reglaIni?: string;
};

/** Regla de asignación automática (ver `iniciativasPmReglas` en db/schema.ts). */
export type ReglaIniciativa = {
  plataforma: string;
  accountId: string;
  /** Nombre de la cuenta al crear la regla. */
  cuenta: string;
  /** Comienzo del nombre de la campaña (sin distinguir mayúsculas). */
  prefijo: string;
};

export type Iniciativa = {
  id: string;
  nombre: string;
  /** false = archivada: deja de recibir campañas y plan, pero conserva su
   *  historial (sus campañas siguen siendo suyas, su gasto no vuelve a "No
   *  atribuido") y su fila aparece solo cuando tiene datos en el tramo mirado. */
  activa: boolean;
  /** Asignadas a mano + las que capturan sus reglas (`porRegla`). */
  campanas: CampanaAsignada[];
  reglas: ReglaIniciativa[];
};

const PLAT_REGLA: Record<string, string> = { meta: "Meta", google: "Google", tiktok: "TikTok" };

/** "Meta · Glovox · nombre que empieza con «Publicación de Instagram»". */
export function describirRegla(r: ReglaIniciativa): string {
  return `${PLAT_REGLA[r.plataforma] ?? r.plataforma} · ${r.cuenta} · nombre que empieza con «${r.prefijo}»`;
}

export const NOMBRE_INICIATIVA_MIN = 2;
export const NOMBRE_INICIATIVA_MAX = 60;

/** Nombre de iniciativa normalizado (espacios colapsados) o null si no sirve. */
export function limpiarNombreIniciativa(v: unknown): string | null {
  const t = String(v ?? "").trim().replace(/\s+/g, " ");
  return t.length >= NOMBRE_INICIATIVA_MIN && t.length <= NOMBRE_INICIATIVA_MAX ? t : null;
}

/** Siguiente id libre (`INI004` si el mayor es `INI003`), contando las archivadas. */
export function siguienteIdIniciativa(ids: string[]): string {
  const max = ids.reduce((m, id) => (INICIATIVA_RE.test(id) ? Math.max(m, Number(id.slice(3))) : m), 0);
  return `INI${String(max + 1).padStart(3, "0")}`;
}

/** Payload del drag & drop entre filas del calendario. */
export const DND_CAMPANA = "application/x-glovox-campana";
export type CampanaArrastrada = {
  plataforma: string;
  campaignId: string;
  campaignName: string;
  /** Iniciativa de origen; null = viene de "No atribuido". */
  desde: string | null;
  /** La capturó una regla: se puede mover a otra iniciativa, no a "No atribuido". */
  porRegla?: boolean;
};
