import type { CrmState } from "./types";
export const emptyState: CrmState = {
  version: 2,
  revision: 0,
  role: "MANAGER",
  customers: [],
  packages: [],
  subscriptions: [],
  tickets: [],
  invoices: [],
  fulfillments: [],
  events: [],
  processedCallbacks: [],
  activity: [],
  connections: { FINANCE: false, SCM: false },
  team: [],
};
