import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { auth } from "@/lib/auth";
import SuperadminPendingsFab from "@/components/SuperadminPendingsFab";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Glovox Data",
  description: "Internal data dashboards",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const role = session?.user?.role ?? "user";
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="h-full bg-[#FAFAFA] text-[#333333]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#333333] focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none focus:ring-2 focus:ring-[#9F99F8]"
        >
          Skip to main content
        </a>
        {children}
        <SuperadminPendingsFab role={role} />
      </body>
    </html>
  );
}
