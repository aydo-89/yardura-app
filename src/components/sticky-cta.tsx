"use client";
import { useState, useEffect } from "react";
import { track } from "@/lib/analytics";

export default function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show after scrolling past hero section
      const heroSection = document.getElementById("services");
      if (heroSection) {
        const heroBottom = heroSection.offsetTop;
        setIsVisible(window.pageYOffset > heroBottom - 100);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden">
      <a
        href="/quote?businessId=yardura"
        data-analytics="cta_quote"
        className="group flex items-center gap-3 px-6 py-4 btn-cta-primary rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20"
        onClick={() => track("cta_sticky_get_quote")}
      >
        <span className="text-sm font-bold">Get Quote</span>
        <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors duration-200">
          <span className="text-lg">💬</span>
        </div>
        {/* Pulse animation ring */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/30 to-transparent animate-ping opacity-20"></div>
      </a>
    </div>
  );
}
