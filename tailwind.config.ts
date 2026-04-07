import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050816",
        slate: "#0d1324",
        glow: "#4df6ff",
        pulse: "#ff4fd8",
        fog: "#9db3ff"
      },
      boxShadow: {
        glass: "0 20px 60px rgba(5, 8, 22, 0.35)",
        neon: "0 0 24px rgba(77, 246, 255, 0.32)"
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(rgba(157,179,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(157,179,255,0.08) 1px, transparent 1px)"
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        pulseRing: "pulseRing 1.2s ease-out forwards"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(1.8)", opacity: "0" }
        }
      }
    }
  },
  plugins: []
};

export default config;
