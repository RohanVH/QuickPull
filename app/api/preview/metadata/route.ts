import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateMediaUrl } from "@/lib/security";

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000";
const ROUTE_TIMEOUT_MS = 7000;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "anonymous";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = rateLimit(`preview-metadata:${ip}`, 30, 60000);

  if (!limiter.allowed) {
    return NextResponse.json({
      error: "Too many preview requests.",
      message: "Please wait a moment and try again.",
      success: false
    });
  }

  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? "";
  const validation = validateMediaUrl(url);

  if (!validation.valid || !validation.url) {
    return NextResponse.json({
      error: validation.reason,
      message: "Please enter a valid supported media link.",
      success: false
    });
  }

  try {
    const response = await Promise.race([
      fetch(`${PYTHON_SERVICE_URL}/preview/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: validation.url }),
        cache: "no-store"
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Metadata preview timed out.")), ROUTE_TIMEOUT_MS);
      })
    ]);

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      throw new Error(payload?.message ?? payload?.error ?? "Unable to fetch metadata preview.");
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("Preview metadata API error:", validation.url, error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch metadata",
      message: "Unable to load preview metadata right now."
    });
  }
}
