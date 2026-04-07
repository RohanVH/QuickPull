import Link from "next/link";

export function Footer() {
  return (
    <footer className="section-shell border-t border-white/10 py-10 text-sm text-[var(--muted)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-[var(--foreground)]">QuickPull</p>
          <p className="mt-2 max-w-xl">
            Universal media downloads with secure previews, clean UX, and an architecture ready for Vercel plus a scalable Python processing service.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4">
          <Link href="/youtube-downloader">YouTube</Link>
          <Link href="/instagram-reels-downloader">Instagram</Link>
          <Link href="/twitter-video-downloader">Twitter</Link>
          <Link href="/manifest.webmanifest">PWA</Link>
        </nav>
      </div>
    </footer>
  );
}
