import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-content-center gap-5 p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold">Halaman tidak ditemukan</h1>
      <Link href="/dashboard" className="text-teal-800 underline">
        Kembali ke dashboard
      </Link>
    </main>
  );
}
