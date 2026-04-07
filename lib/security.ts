const PRIVATE_IP_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "169.254.169.254"
]);

export function normalizeMediaUrl(value: string) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname.includes("youtube.com") && parsed.pathname === "/watch") {
    const videoId = parsed.searchParams.get("v");
    if (videoId) {
      parsed.search = `?v=${videoId}`;
      parsed.hash = "";
    }
  }

  if (hostname === "youtu.be") {
    parsed.search = "";
    parsed.hash = "";
  }

  return parsed.toString();
}

export function validateMediaUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, reason: "Only http and https URLs are allowed." };
    }

    if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return { valid: false, reason: "Blocked destination." };
    }

    if (PRIVATE_IP_RANGES.some((pattern) => pattern.test(parsed.hostname))) {
      return { valid: false, reason: "Private network addresses are blocked." };
    }

    return { valid: true, url: normalizeMediaUrl(parsed.toString()) };
  } catch {
    return { valid: false, reason: "Enter a valid URL." };
  }
}

