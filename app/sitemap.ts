import type { MetadataRoute } from "next";
import { platformDetails } from "@/lib/platforms";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quickpull.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(platformDetails).map((item) => ({
    url: item.path === "universal-media-downloader" ? siteUrl : `${siteUrl}/${item.path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: item.path === "universal-media-downloader" ? 1 : 0.8
  }));
}
