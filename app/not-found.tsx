import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section-shell flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">404</p>
      <h1 className="mt-4 text-5xl font-semibold">This page drifted out of orbit.</h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        The downloader page you requested is not available. Jump back to the homepage and start a fresh pull.
      </p>
      <Link href="/" className="mt-8 rounded-full bg-cyan-300 px-6 py-3 font-medium text-slate-950">
        Return home
      </Link>
    </main>
  );
}
