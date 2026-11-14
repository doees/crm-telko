import type { Metadata } from "next";
import "./globals.css";
import { CrmProvider } from "@/modules/crm/provider";
export const metadata: Metadata = {
  title: { default: "Dashboard | Nusa CRM", template: "%s | Nusa CRM" },
  description:
    "Nusa CRM — manajemen pelanggan, langganan, dan layanan telekomunikasi.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <CrmProvider>{children}</CrmProvider>
      </body>
    </html>
  );
}
