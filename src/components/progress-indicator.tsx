'use client';
import { useState, useEffect } from 'react';

const sections = [
  { id: 'services', label: 'Services', icon: '🛠️' },
  { id: 'insights', label: 'Insights', icon: '🔬' },
  { id: 'eco', label: 'Eco Impact', icon: '🌱' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
  { id: 'quote', label: 'Get Quote', icon: '📝' },
];

export default function ProgressIndicator() {
  const [, setActiveSection] = useState('');

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

  return null;
}
