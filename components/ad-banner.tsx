export function AdBanner({ label = "Sponsored" }: { label?: string }) {
  return (
    <aside className="glass-panel rounded-[28px] p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
        <span>{label}</span>
        <span>Ad Slot</span>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center">
        <p className="text-lg font-medium">Clean banner space for compliant monetization.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Designed for non-intrusive promotions with no popups or forced redirects.
        </p>
      </div>
    </aside>
  );
}
