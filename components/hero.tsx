"use client";

import { motion } from "framer-motion";
import { InputBox } from "@/components/input-box";
import { HeroScene } from "@/components/hero-scene";
import { ThemeToggle } from "@/components/theme-toggle";

export function Hero() {
  return (
    <section className="hero-noise relative min-h-screen overflow-hidden">
      <HeroScene />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,246,255,0.12),transparent_30%),linear-gradient(180deg,rgba(5,8,22,0.1),rgba(5,8,22,0.7))]" />

      <div className="section-shell relative z-10 flex min-h-screen flex-col pb-16 pt-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.34em] text-cyan-300/80">QuickPull</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Universal media downloader for modern, secure pull workflows.</p>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center py-14">
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mx-auto max-w-4xl text-center"
            >
              {/* <p className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-300/85">
                Production-ready on Next.js + Python
              </p> */}
              <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
                <span className="text-gradient">Pull Anything.</span> Instantly.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                QuickPull detects the source, previews the media, and routes secure downloads for video, audio, and image-heavy platforms in one premium experience.
              </p>
            </motion.div>

            <div className="mt-12">
              <InputBox />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
