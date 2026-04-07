"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Link2, RefreshCcw, Search, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlatformIcon } from "@/components/icons";
import { PreviewCard } from "@/components/preview-card";
import { detectPlatform } from "@/lib/platforms";
import { MediaFormatOption, MediaPreview } from "@/lib/types";

interface ApiError {
  error: string;
  message?: string;
  success?: boolean;
}

interface DownloadResponse {
  jobId: string;
  downloadUrl?: string;
  status: string;
  error?: string;
  filename?: string;
}

interface HistoryItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  timestamp: number;
}

export type DownloadPreset = "fastest" | "balanced" | "highest";

const previewMessages = [
  "Analyzing link...",
  "Detecting platform...",
  "We’re retrying with advanced methods...",
  "Fetching formats...",
  "Almost ready..."
];

const downloadMessages = [
  "Preparing your media...",
  "Optimizing delivery...",
  "Finalizing download link...",
  "Almost ready..."
];

const CLIENT_PREVIEW_TIMEOUT_MS = 15000;
const ASSUMED_DOWNLOAD_SPEED_MBPS = 10;
const EMPTY_FORMATS = { video: [], audio: [], combined: [] } as MediaPreview["formats"];

function getDefaultFormatId(preview: MediaPreview | null) {
  if (!preview) return "";
  return preview.formats.combined[0]?.id ?? preview.formats.video[0]?.id ?? preview.formats.audio[0]?.id ?? "";
}

function resolutionRank(value: string | null) {
  if (!value) return 0;
  const match = value.match(/(\d{3,4})p/i);
  if (match) return Number(match[1]);
  const dimensionMatch = value.match(/(\d{3,4})x(\d{3,4})/i);
  if (dimensionMatch) return Number(dimensionMatch[2]);
  if (value.toLowerCase().includes("best")) return 9999;
  return 0;
}

function sizeRank(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = unit === "GB" ? 1024 * 1024 * 1024 : unit === "MB" ? 1024 * 1024 : unit === "KB" ? 1024 : 1;
  return amount * multiplier;
}

function bitrateRank(value: string | null) {
  if (!value) return 0;
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function pickPresetFormat(preview: MediaPreview | null, preset: DownloadPreset) {
  if (!preview) return "";

  const combinedActual = preview.formats.combined.filter((format) => !format.id.endsWith(":best"));
  const combinedAll = preview.formats.combined;
  const video = [...preview.formats.video];
  const audio = [...preview.formats.audio];

  if (preset === "highest") {
    return combinedAll[0]?.id ?? highestResolution(video)?.id ?? highestBitrate(audio)?.id ?? getDefaultFormatId(preview);
  }

  if (preset === "balanced") {
    const balancedCombined = closestResolution(combinedActual, 720);
    const balancedVideo = closestResolution(video, 720);
    const balancedAudio = closestBitrate(audio, 192);
    return balancedCombined?.id ?? balancedVideo?.id ?? combinedAll[0]?.id ?? balancedAudio?.id ?? getDefaultFormatId(preview);
  }

  const fastestCombined = smallestFormat(combinedActual);
  const fastestAudio = smallestAudio(audio);
  const fastestVideo = smallestFormat(video);
  return fastestCombined?.id ?? fastestAudio?.id ?? fastestVideo?.id ?? getDefaultFormatId(preview);
}

function smallestFormat(formats: MediaFormatOption[]) {
  return [...formats].sort((a, b) => {
    const sizeDelta = sizeRank(a.sizeEstimate) - sizeRank(b.sizeEstimate);
    if (Number.isFinite(sizeDelta) && sizeDelta !== 0) return sizeDelta;
    return resolutionRank(a.resolution) - resolutionRank(b.resolution);
  })[0];
}

function smallestAudio(formats: MediaFormatOption[]) {
  return [...formats].sort((a, b) => {
    const sizeDelta = sizeRank(a.sizeEstimate) - sizeRank(b.sizeEstimate);
    if (Number.isFinite(sizeDelta) && sizeDelta !== 0) return sizeDelta;
    return bitrateRank(a.audioBitrate) - bitrateRank(b.audioBitrate);
  })[0];
}

function highestResolution(formats: MediaFormatOption[]) {
  return [...formats].sort((a, b) => resolutionRank(b.resolution) - resolutionRank(a.resolution))[0];
}

function highestBitrate(formats: MediaFormatOption[]) {
  return [...formats].sort((a, b) => bitrateRank(b.audioBitrate) - bitrateRank(a.audioBitrate))[0];
}

function closestResolution(formats: MediaFormatOption[], target: number) {
  return [...formats].sort((a, b) => Math.abs(resolutionRank(a.resolution) - target) - Math.abs(resolutionRank(b.resolution) - target))[0];
}

function closestBitrate(formats: MediaFormatOption[], target: number) {
  return [...formats].sort((a, b) => Math.abs(bitrateRank(a.audioBitrate) - target) - Math.abs(bitrateRank(b.audioBitrate) - target))[0];
}

function findFormatById(preview: MediaPreview | null, formatId: string) {
  if (!preview) return null;
  return [...preview.formats.combined, ...preview.formats.video, ...preview.formats.audio].find((format) => format.id === formatId) ?? null;
}

function durationToSeconds(value: string | null) {
  if (!value) return 0;
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function parseKnownBytes(sizeEstimate: string) {
  const rank = sizeRank(sizeEstimate);
  return Number.isFinite(rank) ? rank : null;
}

function estimateBytes(format: MediaFormatOption, durationSeconds: number) {
  const knownBytes = parseKnownBytes(format.sizeEstimate);
  if (knownBytes) return knownBytes;
  if (!durationSeconds) return null;

  const audioKbps = bitrateRank(format.audioBitrate);
  if (format.type === "audio") {
    const kbps = audioKbps || 192;
    return (kbps * 1000 / 8) * durationSeconds;
  }

  const resolution = resolutionRank(format.resolution);
  const videoMbps =
    resolution >= 2160 ? 28 :
    resolution >= 1440 ? 16 :
    resolution >= 1080 ? 8 :
    resolution >= 720 ? 5 :
    resolution >= 480 ? 2.5 :
    resolution >= 360 ? 1.2 :
    resolution >= 240 ? 0.7 : 0.35;
  const audioMbps = format.hasAudio ? 0.16 : 0.128;
  return ((videoMbps + audioMbps) * 1_000_000 / 8) * durationSeconds;
}

function formatEstimateLabel(seconds: number | null, preset: DownloadPreset) {
  if (seconds && Number.isFinite(seconds)) {
    if (seconds < 60) return `~${Math.max(1, Math.round(seconds))} sec`;
    const minutes = Math.round(seconds / 6) / 10;
    return `~${minutes} min`;
  }

  if (preset === "fastest") return "Fast";
  if (preset === "highest") return "Slow";
  return "Medium";
}

function buildPresetEstimates(preview: MediaPreview | null) {
  const durationSeconds = durationToSeconds(preview?.duration ?? null);
  const bytesPerSecond = (ASSUMED_DOWNLOAD_SPEED_MBPS * 1_000_000) / 8;

  const estimateForPreset = (preset: DownloadPreset) => {
    const matchedFormat = findFormatById(preview, pickPresetFormat(preview, preset));
    const estimatedBytes = matchedFormat ? estimateBytes(matchedFormat, durationSeconds) : null;
    const estimatedSeconds = estimatedBytes ? estimatedBytes / bytesPerSecond : null;
    return formatEstimateLabel(estimatedSeconds, preset);
  };

  return {
    fastest: estimateForPreset("fastest"),
    balanced: estimateForPreset("balanced"),
    highest: estimateForPreset("highest")
  };
}

export function InputBox() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [preset, setPreset] = useState<DownloadPreset>("balanced");
  const [enhance, setEnhance] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isFormatsLoading, setIsFormatsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const requestIdRef = useRef(0);
  const previewInFlightRef = useRef(false);
  const platform = detectPlatform(url);
  const hasFormats = useMemo(() => Boolean(preview && getDefaultFormatId(preview)), [preview]);
  const presetEstimates = useMemo(() => buildPresetEstimates(preview), [preview]);

  useEffect(() => {
    if (!isPreviewLoading && !isFormatsLoading && !isDownloading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((current) => current + 1);
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isPreviewLoading, isFormatsLoading, isDownloading]);

  useEffect(() => {
    if (preview) {
      const panel = document.getElementById("preview-formats");
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [preview]);

  async function fetchFormats(targetUrl: string, requestId: number) {
    setIsFormatsLoading(true);

    try {
      const response = await Promise.race([
        fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl })
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Formats timed out. Try again in a moment.")), CLIENT_PREVIEW_TIMEOUT_MS);
        })
      ]);

      const payload = (await response.json().catch(() => ({ error: "Format preview failed." }))) as MediaPreview & ApiError;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || payload.success === false || payload.error) {
        throw new Error(payload.message ?? payload.error ?? "Unable to fetch formats.");
      }

      setPreview(payload);
      setPreset("balanced");
      setSelectedFormat(pickPresetFormat(payload, "balanced") || getDefaultFormatId(payload));
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setMessage(error instanceof Error ? error.message : "Preview loaded, but formats are still unavailable.");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFormatsLoading(false);
      }
    }
  }

  async function fetchPreview(targetUrl: string) {
    const normalizedUrl = targetUrl.trim();
    if (!normalizedUrl || isPreviewLoading || isFormatsLoading || previewInFlightRef.current) return;

    const requestId = ++requestIdRef.current;
    console.log("Preview triggered for:", normalizedUrl);
    previewInFlightRef.current = true;

    setMessage(null);
    setErrorMessage(null);
    setSuccess(false);
    setPreview(null);
    setSelectedFormat("");
    setPreset("balanced");
    setIsFormatsLoading(false);
    setIsPreviewLoading(true);

    try {
      const response = await Promise.race([
        fetch("/api/preview/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl })
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Preview timed out. Try again in a moment.")), 7000);
        })
      ]);

      const payload = (await response.json().catch(() => ({ error: "Preview failed." }))) as MediaPreview & ApiError;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || payload.success === false || payload.error) {
        throw new Error(payload.message ?? payload.error ?? "Unable to fetch media. Try again.");
      }

      const partialPreview: MediaPreview = {
        ...payload,
        url: normalizedUrl,
        formats: EMPTY_FORMATS
      };

      setPreview(partialPreview);
      setSelectedFormat("");
      setIsPreviewLoading(false);
      previewInFlightRef.current = false;
      void fetchFormats(normalizedUrl, requestId);
      return;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Failed to fetch preview");
      setPreview(null);
    } finally {
      if (requestId === requestIdRef.current) {
        previewInFlightRef.current = false;
        setIsPreviewLoading(false);
      }
    }
  }

  async function handlePaste() {
    try {
      const value = await navigator.clipboard.readText();
      setUrl(value);
      if (value.trim()) {
        void fetchPreview(value);
      }
    } catch {
      setErrorMessage("Clipboard access failed. Paste the link manually and click Fetch Preview.");
    }
  }

  function handlePreview() {
    if (!url.trim()) return;
    void fetchPreview(url);
  }

  async function submitDownload(overrideFormatId?: string) {
    const formatId = overrideFormatId ?? selectedFormat;
    if (!preview || !formatId || isPreviewLoading || isFormatsLoading || isDownloading) return;

    setIsDownloading(true);
    setMessage(null);
    setErrorMessage(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: preview.url,
          previewId: preview.id,
          formatId,
          enhance
        })
      });

      const payload = (await response.json()) as DownloadResponse | ApiError;

      if (!response.ok || (payload as ApiError).error) {
        setErrorMessage((payload as ApiError).message ?? (payload as ApiError).error);
        return;
      }

      let finalResult = payload as DownloadResponse;

      if (!finalResult.downloadUrl && finalResult.jobId) {
        setMessage(overrideFormatId ? "Preparing preset download..." : "Preparing your selected format...");
        finalResult = await pollDownloadJob(finalResult.jobId);
      }

      if (!finalResult.downloadUrl) {
        setErrorMessage(finalResult.error ?? "The selected format could not be prepared.");
        return;
      }

      setSuccess(true);
      setMessage("Downloading...");
      await triggerBrowserDownload(finalResult.downloadUrl, finalResult.filename ?? `${preview.title}.mp4`);
      setMessage("Download started.");

      const historyRaw = window.localStorage.getItem("quickpull-history");
      const current = historyRaw ? (JSON.parse(historyRaw) as HistoryItem[]) : [];
      const timestamp = Date.now();
      const next = [
        {
          id: `${preview.id}-${timestamp}`,
          title: preview.title,
          url: preview.url,
          platform: preview.platform,
          timestamp
        },
        ...current
      ].slice(0, 6);
      window.localStorage.setItem("quickpull-history", JSON.stringify(next));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setIsDownloading(false);
    }
  }

  function handleQuickDownload() {
    const presetFormat = pickPresetFormat(preview, preset);
    if (!presetFormat) return;
    setSelectedFormat(presetFormat);
    void submitDownload(presetFormat);
  }

  function handlePresetChange(nextPreset: DownloadPreset) {
    setPreset(nextPreset);
    const nextFormat = pickPresetFormat(preview, nextPreset);
    if (nextFormat) {
      setSelectedFormat(nextFormat);
    }
  }

  function handleFormatChange(formatId: string) {
    setSelectedFormat(formatId);
  }

  const activeLoadingMessage = isDownloading
    ? downloadMessages[loadingMessageIndex % downloadMessages.length]
    : previewMessages[loadingMessageIndex % previewMessages.length];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div
        className={`glass-panel relative overflow-hidden rounded-[36px] p-5 transition duration-500 sm:p-7 ${
          isPreviewLoading || isFormatsLoading || isDownloading ? "shadow-[0_0_80px_rgba(77,246,255,0.15)]" : ""
        }`}
      >
        <div className="hero-grid absolute inset-0 bg-hero-grid bg-[length:42px_42px] opacity-20" />
        <AnimatePresence>
          {isPreviewLoading || isDownloading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(77,246,255,0.12),transparent_45%)]"
            />
          ) : null}
        </AnimatePresence>
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Universal Detection</p>
              <h2 className="mt-2 text-3xl font-semibold">Paste one link. We sort out the rest.</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
              <PlatformIcon name={platform.icon as never} className="h-4 w-4 text-cyan-300" />
              {platform.label}
            </div>
          </div>

          <div className="relative mt-8">
            <AnimatePresence>
              {url ? (
                <motion.span
                  key={url}
                  initial={{ scale: 0.8, opacity: 0.4 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.01 : 0.75, ease: "easeOut" }}
                  className="pointer-events-none absolute left-6 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full border border-cyan-300/50"
                />
              ) : null}
            </AnimatePresence>

            <div className="flex flex-col gap-4 rounded-[30px] border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                <Link2 className="h-5 w-5 text-cyan-300" />
              </div>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a YouTube, Instagram, TikTok, Spotify, X, Reddit or Facebook link"
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/35"
                aria-label="Media URL"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={isPreviewLoading || isFormatsLoading || isDownloading}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 px-4 text-sm transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Paste
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={handlePreview}
              disabled={!url.trim() || isPreviewLoading || isFormatsLoading || isDownloading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-3 font-medium text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPreviewLoading ? <WandSparkles size={18} className="animate-pulse" /> : <Search size={18} />}
              {isPreviewLoading ? "Fetching Preview..." : "Fetch Preview"}
            </motion.button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {["Auto-detect platform", "Preview metadata before pull", "Optional AI enhancement"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--muted)]">
                {item}
              </div>
            ))}
          </div>

          <AnimatePresence>
            {isPreviewLoading || isDownloading ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 flex items-center gap-3 rounded-[24px] border border-cyan-300/20 bg-cyan-300/5 px-4 py-4"
              >
                <div className="h-10 w-10 shrink-0 rounded-full border-2 border-cyan-300/30 border-t-cyan-300 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {isDownloading ? "Downloading..." : "Preparing preview..."}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{activeLoadingMessage}</p>
                </div>
              </motion.div>
            ) : errorMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-6 rounded-[24px] border border-red-400/20 bg-red-400/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-red-200">This link is harder to process</p>
                    <p className="mt-1 text-sm text-red-100/80">{errorMessage}</p>
                    <p className="mt-2 text-xs text-red-100/70">Try again, add cookies for protected platforms, or use a different link.</p>
                    <button
                      type="button"
                      onClick={handlePreview}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-100 transition hover:border-red-200/50"
                    >
                      <RefreshCcw size={14} />
                      Retry
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : message ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
              >
                {success ? <CheckCircle2 size={16} className="text-emerald-300" /> : <WandSparkles size={16} className="text-cyan-300" />}
                {message}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <PreviewCard
        preview={preview}
        selectedFormat={selectedFormat}
        activePreset={preset}
        presetEstimates={presetEstimates}
        onPresetChange={handlePresetChange}
        onFormatChange={handleFormatChange}
        enhance={enhance}
        onEnhanceChange={setEnhance}
        onDownload={() => void submitDownload()}
        onQuickDownload={handleQuickDownload}
        isSubmitting={isPreviewLoading || isFormatsLoading || isDownloading}
        isSuccess={success}
        hasFormats={hasFormats}
        isLoading={isPreviewLoading}
        isFormatsLoading={isFormatsLoading}
        loadingMessage={activeLoadingMessage}
        onOpenOriginal={(targetUrl) => window.open(targetUrl, "_blank", "noopener,noreferrer")}
      />
    </div>
  );
}

async function pollDownloadJob(jobId: string, attempts = 24, intervalMs = 1000): Promise<DownloadResponse> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`/api/download/${jobId}`, {
      method: "GET",
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as DownloadResponse | ApiError | null;

    if (!response.ok || !payload) {
      throw new Error((payload as ApiError | null)?.error ?? "Unable to check download status.");
    }

    const job = payload as DownloadResponse;
    if (job.status === "completed" && job.downloadUrl) {
      return job;
    }

    if (job.status === "failed") {
      return job;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  throw new Error("The selected format is still processing. Please try again in a moment.");
}

async function triggerBrowserDownload(url: string, fallbackFilename: string) {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error("Unable to download the prepared file.");
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const contentDisposition = response.headers.get("content-disposition");
  const headerFilename = contentDisposition?.match(/filename="?([^";]+)"?/)?.[1];
  const filename = headerFilename || fallbackFilename || "quickpull-download";

  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}








