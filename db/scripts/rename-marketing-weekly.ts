// One-off: renombra el dashboard marketing.weekly a "VENTA DIARIA" en la tabla
// `dashboards` (fuente de verdad runtime del título editable). El sync del
// catálogo respeta ediciones existentes, por eso este cambio no se propaga solo.
// Idempotente: solo escribe si el título sigue en el valor viejo.
//
//   dotenv -e .env.local -- tsx db/scripts/rename-marketing-weekly.ts
import { eq } from "drizzle-orm";
import { db } from "../index";
import { dashboards } from "../schema";

const KEY = "marketing.weekly";
const NEW_TITLE = "VENTA DIARIA";
const NEW_LABEL = "Venta diaria";

async function main() {
  const before = await db
    .select({
      key: dashboards.key,
      title: dashboards.title,
      label: dashboards.label,
    })
    .from(dashboards)
    .where(eq(dashboards.key, KEY));

  console.log("before:", JSON.stringify(before));

  if (before.length === 0) {
    console.log(
      `No existe la fila ${KEY}; se sembrará como "${NEW_TITLE}" en la próxima request.`,
    );
    return;
  }

  if (before[0].title === NEW_TITLE && before[0].label === NEW_LABEL) {
    console.log("Ya está renombrado; nada que hacer.");
    return;
  }

  const after = await db
    .update(dashboards)
    .set({ title: NEW_TITLE, label: NEW_LABEL })
    .where(eq(dashboards.key, KEY))
    .returning({
      key: dashboards.key,
      title: dashboards.title,
      label: dashboards.label,
    });

  console.log("after:", JSON.stringify(after));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
