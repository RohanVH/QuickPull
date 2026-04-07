import { Metadata } from "next";
import { platformDetails } from "@/lib/platforms";
import { SupportedPlatform } from "@/lib/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quickpull.app";

export function createMetadata(platform: SupportedPlatform = "generic"): Metadata {
  const item = platformDetails[platform];
  const title = `${item.name} | QuickPull`;
  const description = item.description;
  const canonical = platform === "generic" ? siteUrl : `${siteUrl}/${item.path}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical },
    keywords: [
      item.keyword,
      "universal media downloader",
      "video downloader",
      "audio downloader",
      "download media online"
    ],
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "QuickPull",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function createSoftwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "QuickPull",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description:
      "QuickPull is a universal media downloader that detects platform URLs and prepares secure video and audio downloads."
  };
}
