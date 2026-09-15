import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";

// Serif display exclusiva de esta pestaña: acompaña el lock-up "LA CAVA"
// (serif clásica sobre verde botella). Se expone como --font-lacava y se usa
// vía la clase .font-lacava (app/globals.css). El resto del sitio sigue en
// Montserrat.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lacava",
  display: "swap",
});

export const metadata: Metadata = {
  title: "La Cava · Glovox",
  description: "Evolución de venta de tickets de La Cava (Jumbo).",
};

export default function LaCavaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${playfair.variable} min-h-screen bg-[#F7F2E7]`}>
      {children}
    </div>
  );
}
