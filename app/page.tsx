import Script from "next/script";
import { AdBanner } from "@/components/ad-banner";
import { FeatureRail } from "@/components/feature-rail";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HistoryPanel } from "@/components/history-panel";
import { PlatformGrid } from "@/components/platform-grid";
import { SectionHeading } from "@/components/section-heading";
import { createMetadata, createSoftwareJsonLd } from "@/lib/seo";

export const metadata = createMetadata("generic");

export default function HomePage() {
  const jsonLd = createSoftwareJsonLd();

  return (
    <>
      <Script
        id="quickpull-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <Hero />

        <section className="section-shell py-20">
          <FeatureRail />
        </section>

        <section className="section-shell py-12">
          <SectionHeading
            eyebrow="SEO Pages"
            title="Optimized landers for high-intent searches"
            copy="Every major source gets its own metadata-rich landing page, keeping search visibility aligned with real user intent."
          />
          <div className="mt-10">
            <PlatformGrid />
          </div>
        </section>

        <section className="section-shell py-12">
          <AdBanner />
        </section>

        <section className="section-shell py-12">
          <HistoryPanel />
        </section>

        <Footer />
      </main>
    </>
  );
}
