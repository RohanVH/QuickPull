import { NextRequest, NextResponse } from "next/server";
import { createDownloadJob, getDownloadJob } from "@/lib/jobs";
import { rateLimit } from "@/lib/rate-limit";
import { validateMediaUrl } from "@/lib/security";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "anonymous";
}

async function waitForCompletion(jobId: string, timeoutMs = 4500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = getDownloadJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return getDownloadJob(jobId);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = rateLimit(`download:${ip}`, 10, 60000);

  if (!limiter.allowed) {
    return NextResponse.json({
      success: false,
      error: "Too many download requests.",
      message: "Please wait a minute and try again."
    });
  }

  const body = (await request.json().catch(() => null)) as {
    url?: string;
    previewId?: string;
    formatId?: string;
    enhance?: boolean;
  } | null;

  const url = body?.url?.trim() ?? "";
  const validation = validateMediaUrl(url);
  if (!validation.valid || !validation.url) {
    return NextResponse.json({
      success: false,
      error: validation.reason,
      message: "Please provide a valid media URL."
    }, { status: 400 });
  }

  const previewId = body?.previewId;
  const formatId = body?.formatId;

  if (!previewId || !formatId) {
    return NextResponse.json({
      success: false,
      error: "Missing preview or format selection.",
      message: "Pick a format before starting the download."
    }, { status: 400 });
  }

  try {
    const queued = createDownloadJob(validation.url, previewId, formatId, Boolean(body?.enhance));
    const result = await waitForCompletion(queued.id);

    if (result?.status === "completed") {
      return NextResponse.json({
        success: true,
        jobId: result.id,
        status: result.status,
        downloadUrl: result.downloadUrl
      });
    }

    if (result?.status === "failed") {
      return NextResponse.json({
        success: false,
        jobId: result.id,
        status: result.status,
        error: result.error ?? "Download job failed.",
        message: "QuickPull could not prepare this download. Try another format or retry."
      });
    }

    return NextResponse.json({
      success: true,
      jobId: queued.id,
      status: queued.status,
      message: "Download is still processing."
    });
  } catch (error) {
    console.error("Download API Error:", validation.url, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to queue download.",
      message: "Download failed. Try again."
    });
  }
}
