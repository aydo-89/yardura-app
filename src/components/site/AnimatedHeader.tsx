'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, LayoutGroup } from 'framer-motion';
import { PhoneCall, Leaf, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { track } from '@/lib/analytics';
import { spring, dur } from '@/lib/motion/presets';

export default function AnimatedHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useReducedMotionSafe();

  const sectionIds = ['hero', 'services', 'pricing', 'insights', 'eco', 'faq'];
  const activeId = useActiveSection(sectionIds);

  // Transform values for scroll-based animations
  const headerHeight = useTransform(scrollY, [0, 120], [88, 56]);
  const logoScale = useTransform(scrollY, [0, 120], [1, 0.96]);
  const backdropBlur = useTransform(scrollY, [0, 120], [0, 6]);
  const headerOpacity = useTransform(scrollY, [0, 120], [0.98, 0.92]);
  const translateY = useTransform(scrollY, (value) => {
    if (value < 120) return 0;
    const diff = value - lastScrollY.current;
    lastScrollY.current = value;
    return diff > 0 ? -10 : 0; // Hide on scroll down, show on scroll up
  });

  const navItems = [
    { href: '#services', label: 'Services', id: 'services' },
    { href: '#pricing', label: 'Pricing', id: 'pricing' },
    { href: '#insights', label: 'Insights', id: 'insights' },
    { href: '#eco', label: 'Eco', id: 'eco', icon: Leaf },
    { href: '#faq', label: 'FAQ', id: 'faq' },
  ];

  // Handle scroll-based header behavior
  useEffect(() => {
    const updateScrollState = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 20);

      // Hide/show logic with threshold
      if (currentScrollY > 120) {
        const scrollingDown = currentScrollY > lastScrollY.current;
        setIsHidden(scrollingDown);
      } else {
        setIsHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Reduced motion variants
  const headerVariants = {
    hidden: { y: -10 },
    visible: { y: 0 },
  };

  return (
    <>
      <motion.header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-sticky bg-white/90 backdrop-blur-md border-b border-accent/10 shadow-sm"
        style={{
          height: prefersReducedMotion ? 88 : headerHeight,
          y: prefersReducedMotion ? 0 : translateY,
          backdropFilter: prefersReducedMotion ? 'blur(6px)' : `blur(${backdropBlur}px)`,
          opacity: prefersReducedMotion ? 0.95 : headerOpacity,
        }}
        animate={prefersReducedMotion ? undefined : isHidden ? 'hidden' : 'visible'}
        variants={headerVariants}
        transition={spring.soft}
      >
        {/* Gradient overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-accent-soft/20 via-transparent to-accent-soft/20"
          animate={{ opacity: isScrolled ? 0.6 : 0.3 }}
          transition={{ duration: dur.fast }}
        />

        <div className="container flex items-center justify-between py-3 relative z-10 h-full">
          {/* Logo Section */}
          <motion.div
            className="flex items-center gap-2"
            style={{ scale: prefersReducedMotion ? 1 : logoScale }}
            transition={spring.soft}
          >
            <motion.img
              src="/yardura-logo.png"
              alt="Yardura logo"
              className="h-9 w-9 rounded-xl shadow-soft object-contain bg-white"
              whileHover={{ scale: 1.05 }}
              transition={spring.snappy}
            />
            <div>
              <motion.div
                className="font-extrabold text-xl text-ink"
                animate={{ fontSize: isScrolled ? '1.125rem' : '1.25rem' }}
                transition={{ duration: dur.fast }}
              >
                Yardura
              </motion.div>
              <motion.div
                className="text-xs text-slate-500"
                animate={{ opacity: isScrolled ? 0.7 : 1 }}
                transition={{ duration: dur.fast }}
              >
                Tech-enabled • Eco-friendly
              </motion.div>
            </div>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <LayoutGroup>
              {navItems.map((item) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative hover:text-accent transition-colors flex items-center gap-1 px-2 py-1 rounded-lg',
                    activeId === item.id && 'text-accent font-medium'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                >
                  {item.icon && <item.icon className="size-4" />}
                  {item.label}
                  {activeId === item.id && (
                    <motion.div
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full"
                      layoutId="activeSection"
                      transition={spring.snappy}
                    />
                  )}
                </motion.a>
              ))}
            </LayoutGroup>

            {/* Primary CTA */}
            <motion.a
              href="/quote"
              data-analytics="cta_quote"
              className="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition font-semibold shadow-soft"
              whileHover={{
                scale: 1.02,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
            >
              Get My Quote
            </motion.a>

            <motion.a
              href="/signup"
              className="px-4 py-2 rounded-xl border hover:bg-accent-soft transition"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
            >
              Sign up
            </motion.a>

            <motion.a
              href="/signin"
              className="px-4 py-2 rounded-xl bg-ink text-white hover:bg-accent transition shadow-soft"
              whileHover={{
                scale: 1.02,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
            >
              Log in
            </motion.a>
          </nav>

          {/* Mobile Navigation Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <motion.a
              href="tel:+18889159273"
              data-analytics="header_phone_call"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-white"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
            >
              <PhoneCall className="size-4" /> Call
            </motion.a>

            <motion.a
              href="/quote"
              data-analytics="cta_quote"
              className="px-4 py-2 rounded-xl bg-accent text-white font-semibold shadow-soft"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring.snappy}
            >
              Get Quote
            </motion.a>

            <motion.button
              onClick={handleMenuToggle}
              className="p-2 rounded-lg hover:bg-accent-soft transition-colors"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isMenuOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: dur.fast }}
                >
                  {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="md:hidden border-t bg-white z-overlay"
              role="dialog"
              aria-modal="true"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
            >
              <nav className="container py-4 space-y-3">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block px-3 py-2 rounded-lg hover:bg-accent-soft hover:text-accent transition-colors flex items-center gap-2',
                      activeId === item.id && 'bg-accent-soft text-accent font-medium'
                    )}
                    onClick={() => setIsMenuOpen(false)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05, ...spring.soft }}
                    whileHover={{ scale: 1.02, x: 4 }}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    {item.label}
                  </motion.a>
                ))}

                <motion.div
                  className="pt-3 border-t space-y-2"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, ...spring.soft }}
                >
                  <motion.a
                    href="/quote"
                    data-analytics="cta_quote"
                    className="block px-3 py-3 rounded-xl bg-accent text-white hover:bg-accent/90 transition shadow-soft text-center font-semibold"
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Get My Quote
                  </motion.a>
                  <motion.a
                    href="/signup"
                    className="block px-3 py-3 rounded-xl bg-ink text-white hover:bg-accent transition shadow-soft text-center font-semibold"
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Create Account
                  </motion.a>
                  <motion.a
                    href="/signin"
                    className="block px-3 py-3 rounded-xl border hover:bg-accent-soft transition text-center font-semibold"
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Log in
                  </motion.a>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer to prevent content jump */}
      <div className="h-22" />
    </>
  );
}
