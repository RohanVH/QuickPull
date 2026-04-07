"use client";

import Image from "next/image";
import { CheckCircle2, Download, Sparkles, Star, TriangleAlert, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { PlatformIcon } from "@/components/icons";
import { LoadingOrb } from "@/components/loading-orb";
import { MediaFormatOption, MediaPreview } from "@/lib/types";
import type { DownloadPreset } from "@/components/input-box";

const iconMap = {
  youtube: "PlayCircle",
  instagram: "Instagram",
  twitter: "Twitter",
  tiktok: "Music4",
  facebook: "Facebook",
  spotify: "Disc3",
  reddit: "MessageCircleMore",
  pinterest: "PinIcon",
  generic: "Globe"
} as const;

const presetOptions: { id: DownloadPreset; label: string; description: string }[] = [
  { id: "fastest", label: "Fastest", description: "Smallest instant-ready option" },
  { id: "balanced", label: "Balanced", description: "720p or closest smart match" },
  { id: "highest", label: "Highest Quality", description: "Maximum detail and fidelity" }
];

const listContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04
    }
  }
};

const listItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

interface PreviewCardProps {
  preview: MediaPreview | null;
  selectedFormat: string;
  activePreset: DownloadPreset;
  presetEstimates: Record<DownloadPreset, string>;
  onPresetChange: (preset: DownloadPreset) => void;
  onFormatChange: (formatId: string) => void;
  enhance: boolean;
  onEnhanceChange: (value: boolean) => void;
  onDownload: () => void;
  onQuickDownload: () => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  hasFormats: boolean;
  isLoading: boolean;
  isFormatsLoading: boolean;
  loadingMessage: string;
  onOpenOriginal?: (url: string) => void;
}

export function PreviewCard({
  preview,
  selectedFormat,
  activePreset,
  presetEstimates,
  onPresetChange,
  onFormatChange,
  enhance,
  onEnhanceChange,
  onDownload,
  onQuickDownload,
  isSubmitting,
  isSuccess,
  hasFormats,
  isLoading,
  isFormatsLoading,
  loadingMessage,
  onOpenOriginal
}: PreviewCardProps) {
  if (!preview && !isLoading) {
    return (
      <div className="glass-panel rounded-[32px] p-6">
        <div className="h-56 rounded-[24px] bg-white/5" />
        <div className="mt-5 h-6 w-2/3 rounded-full bg-white/5" />
        <div className="mt-3 h-4 w-1/3 rounded-full bg-white/5" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[32px] p-6">
        <div className="flex min-h-[620px] flex-col items-center justify-center rounded-[28px] border border-cyan-300/15 bg-gradient-to-b from-cyan-300/8 to-transparent px-6 text-center">
          <LoadingOrb />
          <p className="mt-6 text-xl font-semibold">Fetching your media options</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{loadingMessage}</p>

          <div className="mt-8 w-full max-w-md space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
                <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (!preview) {
    return null;
  }

  const sections = [
    {
      key: "combined",
      title: "Best Quality",
      subtitle: "Combined video + audio when available",
      formats: preview.formats.combined
    },
    {
      key: "video",
      title: "Video",
      subtitle: "Resolution-focused streams for every supported platform",
      formats: prioritizeFormats("video", preview.formats.video)
    },
    {
      key: "audio",
      title: "Audio",
      subtitle: "Standalone audio tracks and bitrate options",
      formats: prioritizeFormats("audio", preview.formats.audio)
    }
  ] as const;

  const hasAnyFormats = sections.some((section) => section.formats.length > 0);
  const showNoFormatsState = !isFormatsLoading && !hasAnyFormats;
  const selectedOption = findSelectedFormat(preview, selectedFormat);

  return (
    <motion.div id="preview-formats" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[32px] p-6 pb-28 md:pb-6">
      <div className="relative overflow-hidden rounded-[28px]">
        {preview.thumbnail ? (
          <Image src={preview.thumbnail} alt={preview.title} width={1200} height={675} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-white/5">
            <LoadingOrb />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-black/40 p-2">
              <PlatformIcon name={iconMap[preview.platform]} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">{platformLabel(preview.platform)}</p>
              <p className="text-sm text-white/80">{preview.duration ?? "Duration pending"}</p>
            </div>
          </div>
          {isSuccess ? (
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-2 text-sm text-emerald-200">
              <CheckCircle2 size={16} />
              Ready
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-2xl font-semibold">{preview.title}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">Multi-engine extraction is active with yt-dlp first and gallery-dl fallback for tougher links.</p>
      </div>

      {preview.message ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-[22px] border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-sm font-medium text-amber-100">Platform notice</p>
          <p className="mt-1 text-sm text-amber-50/80">{preview.message}</p>
          {preview.fallback && preview.platform === "pinterest" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-amber-50/70">Pinterest content may be restricted. Try opening directly.</p>
              {preview.openUrl && onOpenOriginal ? (
                <button
                  type="button"
                  onClick={() => onOpenOriginal(preview.openUrl!)}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 px-3 py-2 text-xs font-medium text-amber-50 transition hover:border-amber-100/50"
                >
                  Open in Pinterest
                </button>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      ) : null}

      {hasFormats ? (
        <>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-[24px] border border-cyan-300/20 bg-gradient-to-r from-cyan-300/12 via-white/5 to-fuchsia-300/12 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">Smart Presets</p>
                <p className="mt-2 text-lg font-semibold">{presetHeadline(activePreset)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{selectedOption ? formatSecondaryLabel(selectedOption, selectedFormat.includes(":combined:") && selectedOption.id === selectedFormat) : presetDescription(activePreset)}</p>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={onQuickDownload}
                disabled={isSubmitting}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(255,255,255,0.12)] transition hover:shadow-[0_12px_48px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <LoadingOrb /> : isSuccess ? <CheckCircle2 size={18} /> : <Zap size={18} />}
                {isSubmitting ? "Preparing download..." : isSuccess ? "Ready to download" : `Quick Download (${presetLabel(activePreset)})`}
              </motion.button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/75">Choose Your Intent</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Pick speed, balance, or maximum quality. QuickPull will select the closest format automatically.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {presetOptions.map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <motion.button
                    key={preset.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onPresetChange(preset.id)}
                    className={`rounded-full border px-4 py-3 text-left transition ${active ? "border-cyan-300/50 bg-cyan-300/12 shadow-[0_0_24px_rgba(77,246,255,0.12)]" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/[0.07]"}`}
                  >
                    <span className="block text-sm font-semibold text-[var(--foreground)]">{preset.label}</span>
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 block text-xs text-[var(--muted)]">
                      {presetEstimates[preset.id]}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}

      {isFormatsLoading ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[24px] border border-cyan-300/15 bg-cyan-300/5 p-5">
          <div className="flex items-center gap-3">
            <LoadingOrb />
            <div>
              <p className="text-sm font-medium text-cyan-100">Loading formats</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{loadingMessage}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
                <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </motion.div>
      ) : hasAnyFormats ? (
        <div className="mt-6 space-y-6">
          {sections.map((section) =>
            section.formats.length ? (
              <div key={section.key}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-cyan-300/75">{section.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{section.subtitle}</p>
                  </div>
                </div>
                <motion.div variants={listContainer} initial="hidden" animate="show" className="grid gap-3">
                  {section.formats.map((format, index) => {
                    const highlightBest = section.key === "combined" && index === 0;
                    const recommended = section.key !== "combined" && isRecommendedFormat(format);
                    return (
                      <motion.div key={format.id} variants={listItem}>
                        <FormatCard format={format} selectedFormat={selectedFormat} onFormatChange={onFormatChange} highlightBest={highlightBest} recommended={recommended} />
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            ) : null
          )}
        </div>
      ) : showNoFormatsState ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-[24px] border border-amber-300/20 bg-amber-300/10 p-5">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-medium text-amber-100">No downloadable formats found</p>
              <p className="mt-1 text-sm text-amber-50/75">This link returned metadata, but no usable media formats were available.</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <Sparkles size={16} className="text-fuchsia-300" />
            Enhance with AI
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Optional post-processing for clarity or upscale. The default flow stays fast.</p>
        </div>
        <button type="button" aria-pressed={enhance} onClick={() => onEnhanceChange(!enhance)} disabled={isSubmitting} className={`relative h-10 w-20 rounded-full transition ${enhance ? "bg-cyan-300/80" : "bg-white/10"} disabled:cursor-not-allowed disabled:opacity-70`}>
          <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${enhance ? "left-11" : "left-1"}`} />
        </button>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-20 md:hidden">
        <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onQuickDownload} disabled={isSubmitting || !hasFormats} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-4 font-medium text-slate-950 shadow-[0_18px_50px_rgba(77,246,255,0.18)] backdrop-blur disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? <LoadingOrb /> : isSuccess ? <CheckCircle2 size={18} /> : <Download size={18} />}
          {isSubmitting ? "Preparing download..." : isSuccess ? "Download ready" : `Quick Download (${presetLabel(activePreset)})`}
        </motion.button>
      </div>

      <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={onDownload} disabled={isSubmitting || !hasFormats} className="mt-6 hidden min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-4 font-medium text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 md:inline-flex">
        {isSubmitting ? <LoadingOrb /> : isSuccess ? <CheckCircle2 size={18} /> : <Download size={18} />}
        {isSubmitting ? "Preparing download..." : isSuccess ? "Download ready" : formatButtonLabel(selectedFormat)}
      </motion.button>
    </motion.div>
  );
}

function FormatCard({
  format,
  selectedFormat,
  onFormatChange,
  highlightBest,
  recommended
}: {
  format: MediaFormatOption;
  selectedFormat: string;
  onFormatChange: (formatId: string) => void;
  highlightBest: boolean;
  recommended: boolean;
}) {
  const selected = selectedFormat === format.id;
  const primaryLabel = formatPrimaryLabel(format, highlightBest);
  const secondaryLabel = formatSecondaryLabel(format, highlightBest);
  const chipLabel = getChipLabel(format);
  const tooltip = buildTooltip(format);

  return (
    <motion.label
      whileTap={{ scale: 0.985 }}
      title={tooltip}
      className={`group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-[24px] border px-4 py-4 transition duration-300 ${selected ? "border-cyan-300/50 bg-cyan-300/10 shadow-[0_0_35px_rgba(77,246,255,0.12)]" : highlightBest ? "border-fuchsia-300/30 bg-fuchsia-300/10 hover:border-fuchsia-200/60 hover:shadow-[0_0_30px_rgba(232,121,249,0.12)]" : "border-white/10 bg-white/5 hover:border-cyan-300/30 hover:bg-white/[0.07] hover:shadow-[0_0_24px_rgba(77,246,255,0.08)]"}`}
    >
      <motion.span aria-hidden="true" initial={{ scale: 0, opacity: 0 }} animate={selected ? { scale: 1.6, opacity: 0.12 } : { scale: 0, opacity: 0 }} className="pointer-events-none absolute inset-0 m-auto h-20 w-20 rounded-full bg-cyan-300 blur-2xl" />
      <div className="relative min-w-0 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          {highlightBest ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200/25 bg-fuchsia-300/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-fuchsia-100">
              <Star className="h-3.5 w-3.5 fill-current" />
              Best
            </span>
          ) : null}
          {recommended ? <span className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-300/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-100">Recommended</span> : null}
          <p className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-[var(--foreground)]">{primaryLabel}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">{chipLabel}</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">{secondaryLabel}</p>
      </div>
      <input type="radio" name="format" checked={selected} onChange={() => onFormatChange(format.id)} className="relative h-5 w-5 shrink-0 accent-cyan-300" />
    </motion.label>
  );
}

function presetLabel(preset: DownloadPreset) {
  return presetOptions.find((option) => option.id === preset)?.label ?? "Balanced";
}

function presetDescription(preset: DownloadPreset) {
  return presetOptions.find((option) => option.id === preset)?.description ?? "720p or closest smart match";
}

function presetHeadline(preset: DownloadPreset) {
  if (preset === "fastest") return "Fastest preset is active";
  if (preset === "highest") return "Highest Quality preset is active";
  return "Balanced preset is active";
}

function getChipLabel(format: MediaFormatOption) {
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(format.ext)) {
    return "Image";
  }
  if (format.hasVideo && format.hasAudio) {
    return "Instant";
  }
  if (format.hasVideo && !format.hasAudio) {
    return format.sourceUrl?.includes(".m3u8") ? "Merge Required" : "Video Only";
  }
  if (format.hasAudio && !format.hasVideo) {
    return "Audio Only";
  }
  return "Merge Required";
}

function buildTooltip(format: MediaFormatOption) {
  return [
    `Type: ${format.type}`,
    format.resolution ? `Resolution: ${compactResolution(format.resolution)}` : null,
    format.audioBitrate ? `Bitrate: ${compactBitrate(format.audioBitrate)}` : null,
    format.sizeEstimate && format.sizeEstimate !== "Unknown" ? `Size: ${format.sizeEstimate}` : null,
    `Format: ${format.ext.toUpperCase()}`
  ].filter(Boolean).join(" | ");
}

function prioritizeFormats(group: "video" | "audio", formats: MediaFormatOption[]) {
  if (group === "video") {
    const recommendedIndex = formats.findIndex((format) => compactResolution(format.resolution ?? "") === "720p");
    if (recommendedIndex > 0) {
      const recommended = formats[recommendedIndex];
      return [recommended, ...formats.slice(0, recommendedIndex), ...formats.slice(recommendedIndex + 1)];
    }
  }

  if (group === "audio") {
    const recommendedIndex = formats.findIndex((format) => compactBitrate(format.audioBitrate ?? "") === "192kbps");
    if (recommendedIndex > 0) {
      const recommended = formats[recommendedIndex];
      return [recommended, ...formats.slice(0, recommendedIndex), ...formats.slice(recommendedIndex + 1)];
    }
  }

  return formats;
}

function isRecommendedFormat(format: MediaFormatOption) {
  return compactResolution(format.resolution ?? "") === "720p" || compactBitrate(format.audioBitrate ?? "") === "192kbps";
}

function findSelectedFormat(preview: MediaPreview, selectedFormat: string) {
  return [...preview.formats.combined, ...preview.formats.video, ...preview.formats.audio].find((format) => format.id === selectedFormat) ?? null;
}

function formatPrimaryLabel(format: MediaFormatOption, highlightBest: boolean) {
  if (highlightBest) {
    return "Download Best Quality";
  }

  const parts = [format.ext.toUpperCase()];

  if (format.type === "audio") {
    if (format.audioBitrate) parts.push(compactBitrate(format.audioBitrate));
  } else if (format.resolution) {
    parts.push(compactResolution(format.resolution));
  }

  return parts.join(" · ");
}

function formatSecondaryLabel(format: MediaFormatOption, highlightBest: boolean) {
  const parts: string[] = [];

  if (highlightBest) {
    parts.push("MP4");
    if (format.resolution) parts.push(compactResolution(format.resolution));
  } else if (format.type === "audio") {
    parts.push("Audio only");
    if (format.audioBitrate) parts.push(compactBitrate(format.audioBitrate));
  } else if (format.type === "video") {
    parts.push("Video only");
    if (format.resolution) parts.push(compactResolution(format.resolution));
  } else if (["jpg", "jpeg", "png", "webp", "gif"].includes(format.ext)) {
    parts.push("Image asset");
    if (format.resolution) parts.push(compactResolution(format.resolution));
  } else if (format.resolution) {
    parts.push(compactResolution(format.resolution));
  }

  if (format.sizeEstimate && format.sizeEstimate !== "Unknown") parts.push(format.sizeEstimate);
  if (!parts.length && format.formatNote) parts.push(cleanFormatNote(format.formatNote));

  return parts.join(" · ") || "Ready to download";
}

function compactResolution(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("best")) return "Best quality";
  const match = value.match(/(\d{3,4})p/);
  if (match) return `${match[1]}p`;
  const dimensionMatch = value.match(/(\d{3,4})x(\d{3,4})/);
  if (dimensionMatch) return `${dimensionMatch[2]}p`;
  return value;
}

function compactBitrate(value: string) {
  const match = value.match(/(\d+)/);
  return match ? `${match[1]}kbps` : value;
}

function cleanFormatNote(note: string) {
  const trimmed = note.trim();
  const parts = trimmed.split(" - ");
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

function formatButtonLabel(selectedFormat: string) {
  const normalized = selectedFormat.includes(":combined:") ? "combined" : selectedFormat.includes(":audio:") ? "audio" : selectedFormat.includes(":video:") ? "video" : "format";

  if (normalized === "combined") return "Download Best Quality";
  if (normalized === "audio") return "Download selected audio";
  if (normalized === "video") return "Download selected video";
  return "Download selected format";
}

function platformLabel(platform: MediaPreview["platform"]) {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X / Twitter";
    case "tiktok":
      return "TikTok";
    case "facebook":
      return "Facebook";
    case "spotify":
      return "Spotify";
    case "reddit":
      return "Reddit";
    case "pinterest":
      return "Pinterest";
    default:
      return "Universal";
  }
}
