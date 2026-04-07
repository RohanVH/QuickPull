"use client";

import dynamic from "next/dynamic";

export const HeroScene = dynamic(
  () => import("@/components/three-hero").then((module) => module.ThreeHero),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-transparent" aria-hidden="true" />
  }
);
