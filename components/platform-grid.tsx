import Link from "next/link";
import { platformDetails } from "@/lib/platforms";

const cards = [
  platformDetails.youtube,
  platformDetails.instagram,
  platformDetails.twitter,
  platformDetails.spotify,
  platformDetails.tiktok,
  platformDetails.reddit
];

export function PlatformGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.path}
          href={`/${card.path}`}
          className="glass-panel group rounded-[28px] p-6 transition hover:-translate-y-1 hover:border-cyan-300/25"
        >
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300/80">{card.keyword}</p>
          <h3 className="mt-3 text-2xl font-semibold">{card.name}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{card.description}</p>
          <span className="mt-6 inline-flex rounded-full border border-white/10 px-3 py-2 text-sm transition group-hover:border-cyan-300/40">
            Open landing page
          </span>
        </Link>
      ))}
    </div>
  );
}
