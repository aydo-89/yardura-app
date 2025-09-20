'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, LayoutGroup } from 'framer-motion';
import { PhoneCall, Menu, X, LucideIcon, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveSection } from '@/hooks/useActiveSection';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { track } from '@/lib/analytics';
import { spring, dur } from '@/lib/motion/presets';
import Link from 'next/link';

type NavItem = {
  href: string;
  label: string;
  id: string;
  icon?: LucideIcon;
};

export default function AnimatedHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();
  const { prefersReducedMotion } = useReducedMotionSafe();

  const sectionIds = ['hero', 'services', 'pricing', 'eco', 'insights', 'faq', 'cities'];
  const activeId = useActiveSection(sectionIds);

  // Transform values for scroll-based animations
  const headerHeight = useTransform(scrollY, [0, 120], [72, 56]);
  const logoScale = useTransform(scrollY, [0, 120], [1, 0.96]);
  const backdropBlur = useTransform(scrollY, [0, 120], [0, 6]);
  const headerOpacity = useTransform(scrollY, [0, 120], [0.98, 0.92]);
  const translateY = useTransform(scrollY, (value) => {
    if (value < 120) return 0;
    const diff = value - lastScrollY.current;
    lastScrollY.current = value;
    return diff > 0 ? -10 : 0; // Hide on scroll down, show on scroll up
  });

  const navItems: NavItem[] = [
    { href: '/#services', label: 'Services', id: 'services' },
    { href: '/#pricing', label: 'Pricing', id: 'pricing' },
    { href: '/city', label: 'Cities', id: 'cities', icon: MapPin },
    { href: '/#eco', label: 'Eco', id: 'eco' },
    { href: '/#insights', label: 'Insights', id: 'insights' },
    { href: '/#faq', label: 'FAQ', id: 'faq' },
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
        className="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-lg"
        style={{
          height: prefersReducedMotion ? 80 : headerHeight,
          y: prefersReducedMotion ? 0 : translateY,
          backdropFilter: prefersReducedMotion ? 'blur(12px)' : `blur(${backdropBlur}px)`,
          opacity: prefersReducedMotion ? 0.98 : headerOpacity,
        }}
        animate={prefersReducedMotion ? undefined : isHidden ? 'hidden' : 'visible'}
        variants={headerVariants}
        transition={spring.soft}
      >
        {/* Enhanced gradient overlay with dynamic opacity */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-green-50/20 via-white/10 to-green-50/20"
          animate={{ opacity: isScrolled ? 0.8 : 0.4 }}
          transition={{ duration: dur.fast }}
        />

        {/* Subtle top accent line */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-500 to-transparent"
          animate={{ opacity: isScrolled ? 1 : 0 }}
          transition={{ duration: dur.fast }}
        />

        <div className="container flex items-center justify-between py-4 relative z-10 h-full">
          {/* Enhanced Logo Section */}
          <Link href="/">
            <motion.div
              className="flex items-center gap-3 cursor-pointer"
              style={{ scale: prefersReducedMotion ? 1 : logoScale }}
              transition={spring.soft}
              whileHover={{ scale: prefersReducedMotion ? 1.02 : (logoScale as any) * 1.05 }}
            >
            <div className="relative">
              <motion.img
                src="/yeller_icon_centered.png"
                alt="Yeller logo"
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl shadow-lg object-cover bg-white border border-slate-200 transform scale-125"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={spring.snappy}
              />
              {/* Active indicator */}
              <motion.div 
                className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <motion.div
                className="font-black text-xl md:text-2xl bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent leading-tight"
                animate={{ fontSize: isScrolled ? '1.25rem' : '1.5rem' }}
                transition={{ duration: dur.fast }}
              >
                Yeller
              </motion.div>
              <motion.div
                className="text-xs text-slate-500 leading-tight font-medium flex items-center gap-1"
                animate={{ opacity: isScrolled ? 0 : 1, height: isScrolled ? 0 : 'auto' }}
                transition={{ duration: dur.fast }}
              >
                <span>by Yardura</span>
                <img
                  src="/yardura-logo.png"
                  alt="Yardura"
                  className="h-4 w-4 rounded-sm object-contain"
                />
              </motion.div>
            </div>
          </motion.div>
          </Link>

          {/* Enhanced Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2 text-sm whitespace-nowrap">
            {/* Navigation pills container */}
            <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-1 shadow-lg">
              <LayoutGroup>
                {navItems.map((item) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2',
                      activeId === item.id 
                        ? 'bg-green-100 text-green-700 shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={spring.snappy}
                    onClick={() => track('nav_click', { section: item.id })}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    {item.label}
                    {activeId === item.id && (
                      <motion.div
                        className="absolute inset-0 bg-green-100 rounded-xl -z-10"
                        layoutId="activeSection"
                        transition={spring.snappy}
                      />
                    )}
                  </motion.a>
                ))}
              </LayoutGroup>
            </div>

            {/* Enhanced CTA buttons */}
            <div className="flex items-center gap-3 ml-4 whitespace-nowrap">
              <motion.a
                href="/quote?businessId=yardura"
                data-analytics="cta_quote"
                className="group relative px-6 py-2.5 rounded-2xl font-bold text-white overflow-hidden bg-gradient-to-r from-green-700 to-green-600 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
                whileHover={{
                  scale: 1.05,
                  boxShadow: '0 20px 40px rgba(20, 184, 166, 0.3)',
                }}
                whileTap={{ scale: 0.95 }}
                transition={spring.snappy}
                onClick={() => track('cta_header_get_quote')}
              >
                {/* Enhanced shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-green-800 to-green-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="relative z-10">Get Quote</span>
              </motion.a>

              <div className="flex items-center gap-2">
                <motion.a
                  href="/signup"
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 transition-all duration-200 font-medium text-slate-700 hover:border-green-300 whitespace-nowrap"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                >
                  Sign up
                </motion.a>

                <motion.a
                  href="/signin"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all duration-200 font-medium shadow-lg whitespace-nowrap"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={spring.snappy}
                >
                  Log in
                </motion.a>
              </div>
            </div>
          </nav>

          {/* Enhanced Mobile Navigation Toggle */}
          <div className="lg:hidden flex items-center gap-3">
            <motion.a
              href="tel:1-888-915-YARD"
              data-analytics="header_phone_call"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-green-700 to-green-600 text-white font-semibold shadow-lg text-sm"
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 10px 25px rgba(123, 179, 105, 0.3)'
              }}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
              onClick={() => track('header_phone_call')}
            >
              <PhoneCall className="size-4" />
              <span className="hidden sm:inline">Call</span>
            </motion.a>

            <motion.a
              href="/quote?businessId=yardura"
              data-analytics="cta_quote"
              className="px-4 py-2 rounded-2xl bg-slate-900 text-white font-bold shadow-lg text-sm"
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
              }}
              whileTap={{ scale: 0.95 }}
              transition={spring.snappy}
              onClick={() => track('cta_header_get_quote')}
            >
              Quote
            </motion.a>

            <motion.button
              onClick={handleMenuToggle}
              className="p-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200 hover:bg-white hover:border-green-300 transition-all duration-200 shadow-lg"
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
                  {isMenuOpen ? <X className="size-5 text-slate-700" /> : <Menu className="size-5 text-slate-700" />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* Enhanced Mobile Navigation Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              className="lg:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-2xl"
              role="dialog"
              aria-modal="true"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
            >
              <nav className="container py-6 space-y-2">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'block px-4 py-3 rounded-2xl font-medium transition-all duration-200 flex items-center gap-3',
                      activeId === item.id 
                        ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' 
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    )}
                    onClick={() => setIsMenuOpen(false)}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05, ...spring.soft }}
                    whileHover={{ scale: 1.02, x: 4 }}
                  >
                    {item.icon && (
                      <div className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-xl',
                        activeId === item.id ? 'bg-green-200' : 'bg-slate-100'
                      )}>
                        <item.icon className="size-4" />
                      </div>
                    )}
                    {item.label}
                  </motion.a>
                ))}

                <motion.div
                  className="pt-6 border-t border-slate-200 space-y-3"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3, ...spring.soft }}
                >
                  <motion.a
                    href="/quote?businessId=yardura"
                    data-analytics="cta_quote"
                    className="block px-4 py-4 rounded-2xl bg-gradient-to-r from-green-700 to-green-600 text-white hover:from-green-700 hover:to-green-600 transition-all duration-300 shadow-lg text-center font-bold"
                    onClick={() => setIsMenuOpen(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClickCapture={() => track('cta_header_get_quote')}
                  >
                    Get My Quote
                  </motion.a>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.a
                      href="/signup"
                      className="px-4 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 transition-all duration-200 text-center font-semibold text-slate-700"
                      onClick={() => setIsMenuOpen(false)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClickCapture={() => track('cta_header_signup')}
                    >
                      Sign Up
                    </motion.a>
                    <motion.a
                      href="/signin"
                      className="px-4 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-all duration-200 text-center font-semibold shadow-lg"
                      onClick={() => setIsMenuOpen(false)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClickCapture={() => track('cta_header_login')}
                    >
                      Log In
                    </motion.a>
                  </div>
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Spacer to prevent content jump */}
      <div className="h-18 md:h-22" />
    </>
  );
}
