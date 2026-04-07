import { randomUUID } from "crypto";
import { cache } from "@/lib/cache";
import { downloadQueue } from "@/lib/queue";
import { detectPlatform } from "@/lib/platforms";
import { DownloadJob } from "@/lib/types";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";

async function runDownload(job: DownloadJob): Promise<DownloadJob> {
  const response = await fetch(`${PYTHON_SERVICE_URL}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: job.url,
      format_id: job.formatId,
      enhance: job.enhance
    }),
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    download_url?: string;
    error?: string;
    message?: string;
  } | null;

  if (!response.ok || !payload || payload.success === false || !payload.download_url) {
    throw new Error(payload?.message ?? payload?.error ?? "Processing service unavailable.");
  }

  return {
    ...job,
    status: "completed",
    downloadUrl: payload.download_url
  };
}

export function createDownloadJob(url: string, previewId: string, formatId: string, enhance: boolean) {
  const platform = detectPlatform(url).platform;
  const job: DownloadJob = {
    id: randomUUID(),
    previewId,
    url,
    platform,
    formatId,
    enhance,
    status: "queued"
  };

  cache.set(`job:${job.id}`, job, 3600);
  return downloadQueue.enqueue(job, async (queuedJob) => {
    const result = await runDownload(queuedJob);
    cache.set(`job:${result.id}`, result, 3600);
    return result;
  });
}

export function getDownloadJob(jobId: string) {
  return downloadQueue.get(jobId) ?? cache.get<DownloadJob>(`job:${jobId}`);
}
