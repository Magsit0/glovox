import { redirect } from "next/navigation";

/** Los mapas se listan en el hub, junto a la presentación de cada evento. */
export default function MapasIndexPage() {
  redirect("/cierres");
}
