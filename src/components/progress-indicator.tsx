"use client";
import { useState, useEffect } from "react";

const sections = [
  { id: 'services', label: 'Services', icon: '🛠️' },
  { id: 'insights', label: 'Insights', icon: '🔬' },
  { id: 'eco', label: 'Eco Impact', icon: '🌱' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
  { id: 'quote', label: 'Get Quote', icon: '📝' },
];

export default function ProgressIndicator() {
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Set initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="hidden lg:flex fixed left-6 top-1/2 transform -translate-y-1/2 z-40 flex-col gap-2">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={`group relative flex items-center justify-center size-12 rounded-full border-2 transition-all duration-200 ${
            activeSection === section.id
              ? 'bg-brand-600 border-brand-600 text-white shadow-lg'
              : 'bg-white border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600'
          }`}
          title={section.label}
        >
          <span className="text-sm">{section.icon}</span>

          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            {section.label}
          </div>
        </a>
      ))}
    </div>
  );
}
