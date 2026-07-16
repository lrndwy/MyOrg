import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="mb-4 text-7xl font-bold text-accent">404</p>
        <h2 className="mb-2 text-2xl font-bold text-foreground">Halaman tidak ditemukan</h2>
        <p className="mb-8 text-text-secondary">
          Halaman yang Anda cari tidak ada atau sudah dipindahkan.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Ke Dashboard
        </Link>
      </div>
    </div>
  );
}
