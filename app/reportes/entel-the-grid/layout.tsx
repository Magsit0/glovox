import { outfit, dmSans } from "./fonts";
import "./report.css";

export const metadata = {
  title: "Entel · The Grid — Reporte",
};

export default function EntelTheGridLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${outfit.variable} ${dmSans.variable} entel-report`}>
      {children}
    </div>
  );
}
