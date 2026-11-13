import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Construction } from "lucide-react";
import { navigation } from "@/lib/navigation";
export function generateStaticParams() {
  return navigation
    .filter((item) => item.href !== "/dashboard")
    .map((item) => ({ module: item.href.slice(1) }));
}
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = navigation.find(
    (entry) => entry.href === `/${module}` && entry.href !== "/dashboard",
  );
  if (!item) notFound();
  return (
    <section className="panel mx-auto mt-8 max-w-2xl p-8 sm:p-12">
      <span className="eyebrow">PENGEMBANGAN BERTAHAP</span>
      <Construction
        className="my-6 text-teal-700"
        size={36}
        aria-hidden="true"
      />
      <h1 className="text-3xl font-semibold tracking-tight">{item.label}</h1>
      <p className="mt-4 leading-7 text-slate-500">
        Modul ini akan dikembangkan pada tahap berikutnya. Tahap 1 menyiapkan
        fondasi aplikasi dan dashboard dengan data contoh.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 font-medium text-teal-800"
      >
        <ArrowLeft size={16} /> Kembali ke dashboard
      </Link>
    </section>
  );
}
