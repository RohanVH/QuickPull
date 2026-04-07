export type SupportedPlatform =
  | "youtube"
  | "instagram"
  | "twitter"
  | "tiktok"
  | "facebook"
  | "spotify"
  | "reddit"
  | "pinterest"
  | "generic";

export type DownloadFormat = "video" | "audio" | "combined";

export interface PlatformMatch {
  platform: SupportedPlatform;
  label: string;
  icon: string;
}

export interface MediaFormatOption {
  id: string;
  type: DownloadFormat;
  ext: string;
  resolution: string | null;
  audioBitrate: string | null;
  sizeEstimate: string;
  formatNote: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  sourceUrl?: string;
}

export interface MediaPreview {
  id: string;
  url: string;
  title: string;
  duration: string | null;
  thumbnail: string | null;
  platform: SupportedPlatform;
  message?: string | null;
  fallback?: boolean;
  openUrl?: string | null;
  formats: {
    video: MediaFormatOption[];
    audio: MediaFormatOption[];
    combined: MediaFormatOption[];
  };
}

export interface DownloadJob {
  id: string;
  previewId: string;
  url: string;
  platform: SupportedPlatform;
  formatId: string;
  enhance: boolean;
  status: "queued" | "processing" | "completed" | "failed";
  downloadUrl?: string;
  error?: string;
}


