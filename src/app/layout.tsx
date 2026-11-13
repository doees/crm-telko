import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Dashboard | Nusa CRM", template: "%s | Nusa CRM" },
  description:
    "Fondasi CRM telekomunikasi — proyek Integrasi Aplikasi Korporasi.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
