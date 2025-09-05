'use client';
import { useState, useEffect } from 'react';

export default function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show after scrolling past hero section
      const heroSection = document.getElementById('services');
      if (heroSection) {
        const heroBottom = heroSection.offsetTop;
        setIsVisible(window.pageYOffset > heroBottom - 100);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 lg:hidden">
      <a
        href="/quote"
        data-analytics="cta_quote"
        className="flex items-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 transition-all duration-200 hover:scale-105"
      >
        <span className="text-sm font-semibold">Get Quote</span>
        <span className="text-lg">📞</span>
      </a>
    </div>
  );
}
