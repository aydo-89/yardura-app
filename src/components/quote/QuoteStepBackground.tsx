"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "@/lib/framermotion";
import { QUOTE_WIZARD_BACKGROUNDS } from "./quoteStepBackgrounds";

type QuoteStepBackgroundProps = {
  stepIndex: number;
};

function pickBackground(stepIndex: number) {
  const safeIndex = Number.isFinite(stepIndex) ? Math.max(0, Math.floor(stepIndex)) : 0;
  return QUOTE_WIZARD_BACKGROUNDS[safeIndex % QUOTE_WIZARD_BACKGROUNDS.length];
}

// Preload the next background image for smoother transitions
function usePreloadNextBackground(stepIndex: number) {
  useEffect(() => {
    const nextBg = pickBackground(stepIndex + 1);
    // Preload both light and dark variants
    const lightImg = new window.Image();
    lightImg.src = nextBg.lightSrc;
    const darkImg = new window.Image();
    darkImg.src = nextBg.darkSrc;
  }, [stepIndex]);
}

export function QuoteStepBackground({ stepIndex }: QuoteStepBackgroundProps) {
  const bg = pickBackground(stepIndex);
  const [isLoaded, setIsLoaded] = useState(stepIndex === 0); // First step shows immediately
  
  // Preload the next step's background
  usePreloadNextBackground(stepIndex);

  return (
    <>
      {/* Crossfade: use "sync" mode so both images overlap during transition */}
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={bg.id}
          className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ 
            opacity: isLoaded ? 1 : 0.95, // Show slightly transparent while loading
            scale: 1,
            transition: { 
              opacity: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
            }
          }}
          exit={{ 
            opacity: 0,
            scale: 0.98,
            transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] }
          }}
        >
          {/* Light */}
          <div className="absolute inset-0 dark:hidden">
            <Image
              src={bg.lightSrc}
              alt=""
              fill
              priority={stepIndex <= 1}
              className="object-cover"
              sizes="100vw"
              style={{ objectPosition: bg.objectPosition ?? "50% center" }}
              onLoad={() => setIsLoaded(true)}
            />
          </div>

          {/* Dark */}
          <div className="absolute inset-0 hidden dark:block">
            <Image
              src={bg.darkSrc}
              alt=""
              fill
              priority={stepIndex <= 1}
              className="object-cover"
              sizes="100vw"
              style={{ objectPosition: bg.objectPosition ?? "50% center" }}
              onLoad={() => setIsLoaded(true)}
            />
          </div>

          {/* Readability overlay (keeps UI consistent across images) */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/55 to-white/30 dark:from-[#020f0a]/80 dark:via-[#02170e]/62 dark:to-[#052618]/38" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,194,77,0.16),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,194,77,0.12),transparent_60%)]" />
        </motion.div>
      </AnimatePresence>
    </>
  );
}


