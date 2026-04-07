import { randomUUID } from "crypto";
import { cache } from "@/lib/cache";
import { detectPlatform } from "@/lib/platforms";
import { MediaPreview } from "@/lib/types";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
const PREVIEW_TIMEOUT_MS = 10000;

const fallbackPreview: MediaPreview["formats"] = {
  combined: [
    {
      id: "ytdlp:combined:best",
      type: "combined",
      ext: "mp4",
      resolution: "Best quality",
      audioBitrate: null,
      sizeEstimate: "Unknown",
      formatNote: "Merged video + audio",
      hasVideo: true,
      hasAudio: true
    }
  ],
  video: [],
  audio: []
};

async function fetchWithRetry(url: string, retries = 0) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await Promise.race([
        fetch(`${PYTHON_SERVICE_URL}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          cache: "no-store"
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("The media service timed out while fetching preview data.")), PREVIEW_TIMEOUT_MS);
        })
      ]);

      const payload = (await response.json().catch(() => null)) as (Partial<MediaPreview> & {
        success?: boolean;
        error?: string;
        message?: string;
        platform?: MediaPreview["platform"];
      }) | null;

      if (!response.ok || !payload || payload.success === false || payload.error) {
        throw new Error(payload?.message ?? payload?.error ?? "Unable to fetch preview.");
      }

      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Preview retry failed.");
}

export async function fetchPreview(url: string): Promise<MediaPreview> {
  const cacheKey = `preview:${url}`;
  const cached = cache.get<MediaPreview>(cacheKey);
  if (cached) return cached;

  let payload: (Partial<MediaPreview> & { success?: boolean; error?: string; message?: string; fallback?: boolean; openUrl?: string | null }) | null;
  try {
    payload = await fetchWithRetry(url, 0);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "The media service is unreachable right now.");
  }

  if (!payload || payload.success === false || payload.error) {
    throw new Error(payload?.message ?? payload?.error ?? "Unable to fetch preview.");
  }

  const preview: MediaPreview = {
    id: payload.id ?? randomUUID(),
    url,
    title: payload.title ?? "Detected media",
    duration: payload.duration ?? null,
    thumbnail: payload.thumbnail ?? null,
    platform: payload.platform ?? detectPlatform(url).platform,
    message: payload.message ?? null,
    formats: payload.formats ?? fallbackPreview
  };

  cache.set(cacheKey, preview, 300);
  return preview;
}



