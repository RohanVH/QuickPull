import { notFound } from "next/navigation";
import Script from "next/script";
import { AdBanner } from "@/components/ad-banner";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { SectionHeading } from "@/components/section-heading";
import { platformDetails } from "@/lib/platforms";
import { createMetadata } from "@/lib/seo";
import { SupportedPlatform } from "@/lib/types";

const entries = Object.entries(platformDetails).filter(([key]) => key !== "generic") as Array<
  [SupportedPlatform, (typeof platformDetails)[SupportedPlatform]]
>;

export function generateStaticParams() {
  return entries.map(([, value]) => ({ slug: value.path }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const match = entries.find(([, item]) => item.path === slug);
  if (!match) return createMetadata("generic");
  return createMetadata(match[0]);
}

export default async function SeoPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const match = entries.find(([, item]) => item.path === slug);
  if (!match) notFound();

  const [platform, detail] = match;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: detail.name,
    description: detail.description,
    about: detail.keyword
  };

  return (
    <>
      <Script
        id={`${platform}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <Hero />
        <section className="section-shell py-14">
          <SectionHeading
            eyebrow={detail.keyword}
            title={detail.name}
            copy={`${detail.description} QuickPull keeps the experience fast, metadata-rich, and optimized for modern search visibility.`}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Paste a supported URL and detect the platform immediately.",
              "Preview thumbnail, title, duration, and available quality options before downloading.",
              "Launch secure processing through a rate-limited, queue-backed backend."
            ].map((item) => (
              <div key={item} className="glass-panel rounded-[28px] p-6 text-sm leading-7 text-[var(--muted)]">
                {item}
              </div>
            ))}
          </div>
        </section>
        <section className="section-shell py-10">
          <AdBanner label="Partner Placement" />
        </section>
        <Footer />
      </main>
    </>
  );
}
