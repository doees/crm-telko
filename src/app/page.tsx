import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardOverview } from "@/modules/dashboard/components/dashboard-overview";

export default function Home() {
  return (
    <DashboardShell>
      <DashboardOverview />
    </DashboardShell>
  );
}
