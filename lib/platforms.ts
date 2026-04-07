import { PlatformMatch, SupportedPlatform } from "@/lib/types";

const platformMap: Array<{ pattern: RegExp; platform: PlatformMatch }> = [
  {
    pattern: /(?:youtube\.com|youtu\.be)/i,
    platform: { platform: "youtube", label: "YouTube", icon: "PlayCircle" }
  },
  {
    pattern: /instagram\.com/i,
    platform: { platform: "instagram", label: "Instagram", icon: "Instagram" }
  },
  {
    pattern: /(?:twitter\.com|x\.com)/i,
    platform: { platform: "twitter", label: "X / Twitter", icon: "Twitter" }
  },
  {
    pattern: /tiktok\.com/i,
    platform: { platform: "tiktok", label: "TikTok", icon: "Music4" }
  },
  {
    pattern: /facebook\.com/i,
    platform: { platform: "facebook", label: "Facebook", icon: "Facebook" }
  },
  {
    pattern: /spotify\.com/i,
    platform: { platform: "spotify", label: "Spotify", icon: "Disc3" }
  },
  {
    pattern: /reddit\.com/i,
    platform: { platform: "reddit", label: "Reddit", icon: "MessageCircleMore" }
  },
  {
    pattern: /(?:pinterest\.com|pin\.it)/i,
    platform: { platform: "pinterest", label: "Pinterest", icon: "PinIcon" }
  }
];

export const platformDetails: Record<
  SupportedPlatform,
  { name: string; path: string; keyword: string; description: string }
> = {
  youtube: {
    name: "YouTube Downloader",
    path: "youtube-downloader",
    keyword: "youtube video downloader",
    description: "Download YouTube videos in HD or extract audio instantly with QuickPull."
  },
  instagram: {
    name: "Instagram Reels Downloader",
    path: "instagram-reels-downloader",
    keyword: "download instagram reels",
    description: "Save Instagram Reels, videos, and carousel media in a premium fast workflow."
  },
  twitter: {
    name: "Twitter Video Downloader",
    path: "twitter-video-downloader",
    keyword: "twitter video download",
    description: "Download X and Twitter videos with clean previews, quality options, and no clutter."
  },
  tiktok: {
    name: "TikTok Downloader",
    path: "tiktok-downloader",
    keyword: "download tiktok video",
    description: "Capture TikTok clips with smart detection and one-click exports."
  },
  facebook: {
    name: "Facebook Video Downloader",
    path: "facebook-video-downloader",
    keyword: "facebook video downloader",
    description: "Save Facebook videos with QuickPull's preview-first download flow."
  },
  spotify: {
    name: "Spotify Song Downloader",
    path: "spotify-song-downloader",
    keyword: "spotify song download",
    description: "Fetch Spotify metadata and route to audio-ready download flows with QuickPull."
  },
  reddit: {
    name: "Reddit Media Downloader",
    path: "reddit-media-downloader",
    keyword: "reddit video downloader",
    description: "Download Reddit-hosted clips and media posts through one unified dashboard."
  },
  pinterest: {
    name: "Pinterest Downloader",
    path: "pinterest-downloader",
    keyword: "pinterest video downloader",
    description: "Save Pinterest videos and images with elegant previews and quality controls."
  },
  generic: {
    name: "Universal Media Downloader",
    path: "universal-media-downloader",
    keyword: "online media downloader",
    description: "QuickPull detects the source automatically and prepares secure downloads."
  }
};

export function detectPlatform(input: string): PlatformMatch {
  const normalized = input.trim();
  for (const entry of platformMap) {
    if (entry.pattern.test(normalized)) {
      return entry.platform;
    }
  }
  return { platform: "generic", label: "Universal", icon: "Globe" };
}
