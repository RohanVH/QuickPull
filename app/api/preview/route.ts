import { NextRequest, NextResponse } from "next/server";
import { fetchPreview } from "@/lib/preview";
import { rateLimit } from "@/lib/rate-limit";
import { validateMediaUrl } from "@/lib/security";

const ROUTE_TIMEOUT_MS = 11000;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "anonymous";
}

async function fetchWithRetry(url: string, retries = 0) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await Promise.race([
        fetchPreview(url),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Preview processing timed out.")), ROUTE_TIMEOUT_MS);
        })
      ]);
    } catch (error) {
      lastError = error;
      console.error(`Preview extraction failed for: ${url} (attempt ${attempt + 1}/${retries + 1})`, error);
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Preview retry failed.");
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limiter = rateLimit(`preview:${ip}`, 20, 60000);

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

  console.info("Preview request received", { url: validation.url, ip });

  try {
    const preview = await fetchWithRetry(validation.url, 0);
    console.info("Preview request completed", {
      url: validation.url,
      platform: preview.platform,
      title: preview.title
    });
    return NextResponse.json(preview, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("Preview API Error:", validation.url, error);

    return NextResponse.json({
      success: false,
      error: "Failed to fetch data",
      message: "Server timeout or failed to process link. We stopped waiting so the UI does not get stuck."
    });
  }
}


