export type DemoCustomer = {
  initials: string;
  name: string;
  number: string;
  email: string;
  package: string;
  speed: string;
  status: "Aktif" | "Menunggu";
  date: string;
  color: string;
};
export const demoCustomers: DemoCustomer[] = [
  {
    initials: "AP",
    name: "Andi Pratama",
    number: "CST-00128",
    email: "andi@example.com",
    package: "Nusa Home",
    speed: "50 Mbps",
    status: "Aktif",
    date: "13 Nov 2026",
    color: "bg-teal-50 text-teal-700",
  },
  {
    initials: "SR",
    name: "Siti Rahmawati",
    number: "CST-00127",
    email: "siti@example.com",
    package: "Nusa Family",
    speed: "100 Mbps",
    status: "Aktif",
    date: "13 Nov 2026",
    color: "bg-violet-50 text-violet-600",
  },
  {
    initials: "BS",
    name: "Budi Santoso",
    number: "CST-00126",
    email: "budi@example.com",
    package: "Nusa Business",
    speed: "200 Mbps",
    status: "Menunggu",
    date: "12 Nov 2026",
    color: "bg-blue-50 text-blue-600",
  },
  {
    initials: "DL",
    name: "Dewi Lestari",
    number: "CST-00125",
    email: "dewi@example.com",
    package: "Nusa Family",
    speed: "100 Mbps",
    status: "Aktif",
    date: "12 Nov 2026",
    color: "bg-rose-50 text-rose-600",
  },
];
export const growth = {
  "6 bulan": {
    labels: ["Jun", "Jul", "Agu", "Sep", "Okt", "Nov"],
    current: [44, 52, 47, 65, 73, 88],
    previous: [28, 38, 34, 45, 51, 60],
    total: "1.284",
    change: "+12,8%",
  },
  "3 bulan": {
    labels: ["Sep", "Okt", "Nov"],
    current: [65, 73, 88],
    previous: [45, 51, 60],
    total: "1.284",
    change: "+8,4%",
  },
} as const;
export const demoTickets = [
  {
    id: "TKT-024",
    title: "Koneksi internet terputus",
    customer: "Budi Santoso",
    priority: "Tinggi",
    color: "bg-rose-50 text-rose-600",
  },
  {
    id: "TKT-023",
    title: "Kecepatan tidak stabil",
    customer: "Andi Pratama",
    priority: "Sedang",
    color: "bg-amber-50 text-amber-700",
  },
  {
    id: "TKT-022",
    title: "Perubahan alamat instalasi",
    customer: "Dewi Lestari",
    priority: "Rendah",
    color: "bg-blue-50 text-blue-600",
  },
];
