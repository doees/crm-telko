"use client";
import { CustomersPage } from "@/modules/customers/components/customers-page";
import { PackagesPage } from "@/modules/packages/components/packages-page";
import { SubscriptionsPage } from "@/modules/subscriptions/components/subscriptions-page";
import { TicketsPage } from "@/modules/tickets/components/tickets-page";
import { IntegrationsPage } from "@/modules/integrations/components/integrations-page";
import { ReportsPage } from "@/modules/reports/components/reports-page";
import { SettingsPage } from "@/modules/settings/components/settings-page";
import { Empty } from "@/components/crm/ui";
export function ModulePage({ module }: { module: string }) {
  switch (module) {
    case "customers":
      return <CustomersPage />;
    case "packages":
      return <PackagesPage />;
    case "subscriptions":
      return <SubscriptionsPage />;
    case "tickets":
      return <TicketsPage />;
    case "integrations":
      return <IntegrationsPage />;
    case "reports":
      return <ReportsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <Empty />;
  }
}
