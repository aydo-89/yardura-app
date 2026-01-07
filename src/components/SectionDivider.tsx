"use client";

import { motion } from "@/lib/framermotion";

interface SectionDividerProps {
  direction?: "up" | "down";
  accent?: "mint" | "gold" | "cream";
}

const accentPalettes: Record<NonNullable<SectionDividerProps["accent"]>, {
  glow: string;
  line: string;
  spark: string;
}> = {
  mint: {
    glow: "radial-gradient(circle, rgba(var(--mint-rgb-commas),0.25), rgba(8,16,12,0) 60%)",
    line: "linear-gradient(90deg, transparent, rgba(var(--mint-rgb-commas),0.55), rgba(var(--mint-rgb-commas),0.75), rgba(var(--mint-rgb-commas),0.55), transparent)",
    spark: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.65), rgba(255,255,255,0))",
  },
  gold: {
    glow: "radial-gradient(circle, rgba(var(--gold-rgb-commas),0.22), rgba(8,16,12,0) 60%)",
    line: "linear-gradient(90deg, transparent, rgba(var(--gold-rgb-commas),0.6), rgba(var(--gold-rgb-commas),0.78), rgba(var(--gold-rgb-commas),0.6), transparent)",
    spark: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))",
  },
  cream: {
    glow: "radial-gradient(circle, rgba(var(--vanilla-rgb-commas),0.3), rgba(8,16,12,0) 60%)",
    line: "linear-gradient(90deg, transparent, rgba(var(--vanilla-rgb-commas),0.65), rgba(var(--vanilla-rgb-commas),0.8), rgba(var(--vanilla-rgb-commas),0.65), transparent)",
    spark: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))",
  },
};

export default function SectionDivider({ direction = "down", accent = "cream" }: SectionDividerProps) {
  const palette = accentPalettes[accent];
  const isDown = direction === "down";

  return (
    <motion.div
      className="section-divider relative isolate pointer-events-none py-8 transition-colors bg-gradient-to-b from-[rgba(var(--mint-rgb-commas),0.07)] via-[rgba(var(--vanilla-rgb-commas),0.9)] to-[rgba(var(--gold-rgb-commas),0.06)] dark:from-[rgba(var(--mint-rgb-commas),0.05)] dark:via-[#07120c] dark:to-[rgba(var(--gold-rgb-commas),0.04)]"
      initial={{ opacity: 0, y: isDown ? -24 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.span
        className="absolute left-1/2 top-1/2 h-32 w-[min(92vw,960px)] -translate-x-1/2 -translate-y-1/2 blur-3xl"
        style={{ background: palette.glow }}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.span
        className="relative mx-auto block h-px w-[min(90vw,860px)] rounded-full"
        style={{
          background: palette.line,
          boxShadow: "0 14px 34px rgba(5,12,9,0.32)",
        }}
      >
        <motion.span
          className="absolute inset-y-[-10px] w-32 rounded-full"
          style={{ background: palette.spark }}
          animate={{ x: ["-10%", "90%", "-10%"], opacity: [0, 1, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.span>
    </motion.div>
  );
}
