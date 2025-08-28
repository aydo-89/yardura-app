"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const images = [
  { src: "/clean_yard1.png", alt: "Clean yard 1" },
  { src: "/clean_yard2.png", alt: "Clean yard 2" },
  { src: "/clean_yard3.png", alt: "Clean yard 3" },
  { src: "/clean_yard4.png", alt: "Clean yard 4" },
  { src: "/clean_yard5.png", alt: "Clean yard 5" },
  { src: "/cute_dog_clean_yard.png", alt: "Happy dog in clean yard" },
  { src: "/yard_yardura_branded.png", alt: "Yardura branded yard" },
];

export default function YardCarousel() {
  const [index, setIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const prev = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  useEffect(() => {
    if (isHovering) return; // pause on hover
    const id = setInterval(next, 4500);
    return () => clearInterval(id);
  }, [isHovering]);

  return (
    <div className="relative group">
      <div
        className="relative overflow-hidden rounded-2xl border border-brand-200 shadow-soft"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Slides */}
        <div
          className="relative flex transition-transform duration-500"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {images.map((img) => (
            <div key={img.src} className="min-w-full h-80 md:h-[460px] bg-slate-100">
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <button
        aria-label="Previous"
        onClick={prev}
        className="absolute top-1/2 -translate-y-1/2 left-3 p-2 rounded-full bg-white/80 hover:bg-white shadow-soft hidden md:inline-flex"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        aria-label="Next"
        onClick={next}
        className="absolute top-1/2 -translate-y-1/2 right-3 p-2 rounded-full bg-white/80 hover:bg-white shadow-soft hidden md:inline-flex"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {images.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2.5 rounded-full transition-all ${
              i === index ? "w-6 bg-brand-600" : "w-2.5 bg-slate-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}


