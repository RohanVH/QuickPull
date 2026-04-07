"use client";

import { motion } from "framer-motion";

export function LoadingOrb() {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <motion.div
        className="absolute h-20 w-20 rounded-full border border-cyan-300/25"
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.8, 0.35] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="h-10 w-10 rounded-full border border-transparent border-t-cyan-300 border-r-fuchsia-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
