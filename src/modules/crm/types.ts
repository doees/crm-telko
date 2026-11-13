import { z } from "zod";
export const customerInput = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(100),
  email: z.union([z.literal(""), z.email("Format email tidak valid")]),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{8,20}$/, "Nomor telepon tidak valid"),
  address: z.string().trim().min(8, "Alamat minimal 8 karakter").max(500),
});
export const packageInput = z.object({
  name: z.string().trim().min(3).max(80),
  speed: z.coerce.number().int().min(10).max(10000),
  price: z.coerce.number().int().min(10000).max(100000000),
  category: z.enum(["HOME", "BUSINESS"]),
  device: z.boolean(),
});
export const ticketInput = z.object({
  customerId: z.string().min(1, "Pilih pelanggan"),
  subscriptionId: z.string(),
  subject: z.string().trim().min(5, "Subjek minimal 5 karakter").max(150),
  description: z
    .string()
    .trim()
    .min(10, "Deskripsi minimal 10 karakter")
    .max(3000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assignee: z.enum([
    "Belum ditugaskan",
    "Raka Wijaya",
    "Nadia Putri",
    "Fajar Akbar",
  ]),
});
export type CustomerInput = z.infer<typeof customerInput>;
export type PackageInput = z.infer<typeof packageInput>;
export type TicketInput = z.infer<typeof ticketInput>;
export type Role = "ADMIN" | "CS" | "TECHNICIAN" | "MANAGER";
export type Customer = CustomerInput & {
  id: string;
  number: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
};
export type ServicePackage = PackageInput & {
  id: string;
  status: "ACTIVE" | "INACTIVE";
};
export type Subscription = {
  id: string;
  number: string;
  customerId: string;
  packageId: string;
  price: number;
  device: boolean;
  address: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
  createdAt: string;
  activatedAt?: string;
};
export type Ticket = TicketInput & {
  id: string;
  number: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  comments: { id: string; author: string; text: string; at: string }[];
};
export type Invoice = {
  id: string;
  number: string;
  subscriptionId: string;
  amount: number;
  status: "PENDING" | "ISSUED" | "PAID";
  createdAt: string;
  externalId?: string;
  paidAt?: string;
};
export type Fulfillment = {
  id: string;
  subscriptionId: string;
  status: "PENDING" | "PROCESSING" | "FULFILLED";
  externalId?: string;
};
export type IntegrationEvent = {
  id: string;
  destination: "FINANCE" | "SCM";
  resourceId: string;
  type: string;
  status: "PENDING" | "FAILED" | "SUCCEEDED";
  attempts: number;
  createdAt: string;
  error?: string;
};
export type Activity = {
  id: string;
  text: string;
  at: string;
  category: "customer" | "subscription" | "ticket" | "integration" | "package";
};
export type CrmState = {
  version: 2;
  revision: number;
  role: Role;
  customers: Customer[];
  packages: ServicePackage[];
  subscriptions: Subscription[];
  tickets: Ticket[];
  invoices: Invoice[];
  fulfillments: Fulfillment[];
  events: IntegrationEvent[];
  processedCallbacks: string[];
  activity: Activity[];
  connections: { FINANCE: boolean; SCM: boolean };
};
export type Command =
  | { type: "SAVE_CUSTOMER"; id?: string; data: CustomerInput }
  | { type: "TOGGLE_CUSTOMER"; id: string }
  | { type: "SAVE_PACKAGE"; id?: string; data: PackageInput }
  | { type: "TOGGLE_PACKAGE"; id: string }
  | {
      type: "CREATE_SUBSCRIPTION";
      customerId: string;
      packageId: string;
      address: string;
    }
  | { type: "SUBSCRIPTION_STATUS"; id: string; status: Subscription["status"] }
  | { type: "SAVE_TICKET"; id?: string; data: TicketInput }
  | { type: "TICKET_STATUS"; id: string; status: Ticket["status"] }
  | { type: "TICKET_ASSIGN"; id: string; assignee: Ticket["assignee"] }
  | { type: "TICKET_COMMENT"; id: string; text: string }
  | { type: "DISPATCH"; id: string }
  | { type: "PAY_INVOICE"; id: string; callbackId: string }
  | { type: "FULFILL"; id: string; callbackId: string }
  | { type: "CONNECTION"; destination: "FINANCE" | "SCM"; connected: boolean }
  | { type: "ROLE"; role: Role };
export type Modal =
  | { kind: "customer" | "package" | "ticket"; id?: string }
  | { kind: "subscription"; customerId?: string; packageId?: string }
  | {
      kind: "customer-detail" | "ticket-detail" | "subscription-detail";
      id: string;
    }
  | { kind: "confirm"; title: string; description: string; action: Command }
  | null;
export const roleLabels: Record<Role, string> = {
  ADMIN: "Administrator",
  CS: "Customer service",
  TECHNICIAN: "Teknisi · Raka",
  MANAGER: "Manajer",
};
export const technicians = [
  "Belum ditugaskan",
  "Raka Wijaya",
  "Nadia Putri",
  "Fajar Akbar",
] as const;
