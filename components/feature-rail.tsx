import { ShieldCheck, Sparkles, TimerReset, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Fast by default",
    copy: "Preview-first flows, dynamic imports, and debounced detection keep performance tight."
  },
  {
    icon: ShieldCheck,
    title: "Security layered in",
    copy: "URL validation, SSRF blocking, payload sanitization, and rate limiting protect the edge."
  },
  {
    icon: TimerReset,
    title: "Burst-ready backend",
    copy: "A queue-backed download pipeline prevents request spikes from overwhelming the service."
  },
  {
    icon: Sparkles,
    title: "Premium polish",
    copy: "Cinematic motion, glass surfaces, and subtle AI enhancement options without slowing the core flow."
  }
];

export function FeatureRail() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="glass-panel rounded-[28px] p-6">
            <div className="inline-flex rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300">
              <Icon size={20} />
            </div>
            <h3 className="mt-5 text-xl font-semibold">{feature.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{feature.copy}</p>
          </div>
        );
      })}
    </div>
  );
}
