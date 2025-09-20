'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { Leaf, Shield, ShieldCheck, Sparkles, MapPin, Users } from 'lucide-react';
import Image from 'next/image';

import Reveal from '@/components/Reveal';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { splitHeadline, dur, ease, spring } from '@/lib/motion/presets';
import { track } from '@/lib/analytics';

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const { prefersReducedMotion } = useReducedMotionSafe();

  // Parallax transforms for background elements
  const blob1Y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const blob2Y = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const blob3Y = useTransform(scrollYProgress, [0, 1], [0, -70]);

  // Magnetic hover effect
  const buttonX = useSpring(useTransform(mouseX, [0, 1920], [-3, 3]), spring.soft);
  const buttonY = useSpring(useTransform(mouseY, [0, 1080], [-3, 3]), spring.soft);

  // Handle mouse movement for magnetic effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isHovered) return;
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  return (
    <section
      ref={heroRef}
      className="min-h-screen gradient-hero-bg relative overflow-hidden flex items-center"
    >
      {/* Professional World's First Banner */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-50 mt-24 hidden md:block"
        initial={{ opacity: 0, y: -15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-white/98 via-slate-50/95 to-white/98 backdrop-blur-xl rounded-2xl border-2 border-slate-200/80 shadow-2xl px-10 py-5 ring-2 ring-slate-300/40">
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-gradient-to-r from-green-600 to-green-700 rounded-full shadow-sm"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-gradient-to-r from-green-600 to-green-700 rounded-full animate-pulse opacity-60"></div>
                </div>
                <span className="text-base font-black text-slate-900 tracking-wide uppercase">World's First</span>
              </div>
              <div className="h-5 w-px bg-slate-400/80"></div>
              <span className="text-base text-slate-800 font-semibold tracking-wide">Pet Waste Health Monitoring & Removal Service</span>
            </div>
          </div>
        </div>
      </motion.div>
      {/* Modern geometric background pattern */}
      <div className="absolute inset-0 opacity-8">
        <div
          className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%22120%22%20height%3D%22120%22%20viewBox%3D%220%200%20120%20120%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%237BB369%22%20fill-opacity%3D%220.15%22%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
          style={{
            animation: prefersReducedMotion ? 'none' : 'pulse 20s infinite',
          }}
        />
      </div>

      {/* Enhanced floating gradient orbs with better positioning */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-green-700/30 to-green-600/40 rounded-full blur-3xl"
          style={{
            y: prefersReducedMotion ? 0 : blob1Y,
            opacity: 0.7,
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-br from-green-700/35 to-green-600/25 rounded-full blur-3xl"
          style={{
            y: prefersReducedMotion ? 0 : blob2Y,
            opacity: 0.5,
          }}
          animate={{
            scale: [1.1, 1, 1.1],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/3 w-72 h-72 bg-gradient-to-br from-green-700/25 to-green-600/35 rounded-full blur-2xl"
          style={{
            y: prefersReducedMotion ? 0 : blob3Y,
            opacity: 0.4,
          }}
          animate={{
            scale: [1, 1.3, 1],
            x: [-30, 30, -30],
            y: [-10, 10, -10],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-3/4 right-1/3 w-56 h-56 bg-gradient-to-br from-green-700/30 to-green-600/25 rounded-full blur-xl"
          animate={{
            scale: [0.8, 1.1, 0.8],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>


      <div
        className="container py-16 md:py-20 grid lg:grid-cols-2 gap-12 items-start relative z-10"
        onMouseMove={handleMouseMove}
      >
        <Reveal>
          <div className="lg:pr-8">

            {/* Enhanced headline with better typography and no awkward wrapping */}
            <motion.div
              className="text-responsive-4xl font-black leading-[1.1] tracking-tight text-slate-900 mb-2 mt-24"
              variants={splitHeadline.container}
              initial="initial"
              animate="animate"
            >
              <motion.span className="block leading-[1.1]" variants={splitHeadline.line}>
                Clean yard.
              </motion.span>
              <motion.span className="block leading-[1.1] bg-gradient-to-r from-green-800 to-green-600 bg-clip-text text-transparent" variants={splitHeadline.line}>
                Smarter insights.
              </motion.span>
              <motion.span
                className="block text-slate-700 font-bold"
                variants={splitHeadline.line}
                transition={{ delay: 0.1 }}
              >
                Less landfill.
              </motion.span>
            </motion.div>

            {/* Lawngevity Tagline */}
            <motion.div
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 border border-green-700/20 shadow-sm backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <span className="font-extrabold text-base md:text-lg">
                <span className="text-green-700">Lawn</span>
                <span className="text-slate-900">gevity</span>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-800 font-semibold">Clean Yards</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-800 font-semibold">Healthy Pets</span>
            </motion.div>

            {/* Enhanced description with better spacing and readability */}
            <motion.p
              className="mt-8 text-responsive-lg leading-relaxed text-slate-600 max-w-2xl text-balance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <span className="font-semibold text-green-700">The world's first intelligent pet stool monitoring & removal service.</span>{' '}
              We combine professional weekly scooping with advanced{' '}
              <span className="text-green-600 font-semibold">AI-powered health insights</span>{' '}
              to keep your Twin Cities yard pristine while monitoring your dog's wellness—catching potential health issues before they become problems.
            </motion.p>

            {/* Coming soon badge with modern styling */}
            <motion.div
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-700/50 to-green-600/30 border border-green-700/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <Sparkles className="size-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-800">AI Health Monitoring Coming Soon</span>
            </motion.div>

            {/* Enhanced service area with modern styling */}
            <motion.div
              className="mt-8 flex items-center gap-4 p-5 bg-white/80 backdrop-blur-md border border-green-700/20 rounded-3xl shadow-card hover:shadow-floating transition-all duration-300 hover:scale-[1.02]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-700/10 to-green-600/15 rounded-2xl shadow-sm">
                <MapPin className="size-6 text-green-600" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">Currently Serving</div>
                <div className="text-sm text-slate-600">South Minneapolis • Richfield • Edina • Bloomington</div>
              </div>
            </motion.div>

            {/* Enhanced CTAs with modern design */}
            <motion.div
              className="mt-12 flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              onHoverStart={() => setIsHovered(true)}
              onHoverEnd={() => setIsHovered(false)}
            >
              <motion.a
                href="/quote?businessId=yardura"
                data-analytics="cta_hero_get_quote"
                className="btn-cta-primary group"
                style={{
                  x: prefersReducedMotion ? 0 : buttonX,
                  y: prefersReducedMotion ? 0 : buttonY,
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
                onClick={() => track('cta_hero_get_quote')}
              >
                <span className="flex items-center gap-2">
                  Get My Quote
                  <span className="text-xl group-hover:translate-x-1 transition-transform duration-200">→</span>
                </span>
              </motion.a>

              <motion.a
                href="#services"
                data-analytics="hero_how_it_works"
                className="btn-cta-ghost px-8 py-4 rounded-2xl font-semibold text-lg text-slate-700 hover:text-slate-800"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
                onClick={() => track('cta_hero_how_it_works')}
              >
                How it works
              </motion.a>
            </motion.div>

            {/* Enhanced trust indicators with modern pill design */}
            <motion.div
              className="mt-10 mb-16 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100/50 border border-green-700/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <ShieldCheck className="size-4 text-green-600" />
                <span className="text-sm font-semibold text-slate-800">No contracts</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100/50 border border-green-700/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <Sparkles className="size-4 text-green-600" />
                <span className="text-sm font-semibold text-slate-800">Early warning alerts</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100/50 border border-green-700/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
                <Leaf className="size-4 text-green-700" />
                <span className="text-sm font-semibold text-slate-800">Eco composting</span>
              </div>
            </motion.div>

          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="relative mt-32">
            {/* Enhanced image container - larger and better proportioned */}
            <div className="relative rounded-3xl bg-white/50 backdrop-blur-md border border-white/80 shadow-3xl p-6 overflow-visible interactive-hover">
              <div className="rounded-2xl overflow-hidden bg-white shadow-floating">
                <video
                  src="/hero-video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-[450px] md:h-[550px] object-cover"
                  poster="/modern_yard.png" // Fallback image while loading
                />
              </div>

              {/* Floating stats card - better positioned */}
              <motion.div
                className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md rounded-3xl border border-green-700/20 shadow-floating p-5 z-10 interactive-hover"
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1, duration: 0.6 }}
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <div className="text-center min-w-[180px]">
                  <div className="text-xs text-green-700 font-medium mb-1">Up to</div>
                  <div className="text-gradient text-4xl font-black mb-1">250+ lbs</div>
                  <div className="text-sm text-green-700 font-semibold leading-tight">kept out of landfill</div>
                  <div className="text-xs text-green-600 font-medium">per dog per year</div>
                  <div className="mt-3 flex items-center justify-center gap-2 px-3 py-1 bg-gradient-to-r from-green-700/30 to-green-600/40 border border-green-700/20 rounded-full">
                    <Leaf className="size-3 text-green-700" />
                    <span className="text-xs text-green-700 font-bold">Eco mission!</span>
                  </div>
                </div>
              </motion.div>

              {/* Enhanced satisfaction guarantee badge */}
              <motion.div
                className="absolute -top-4 -right-4 bg-gradient-to-br from-green-800 to-green-700 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-floating border-2 border-white/60 backdrop-blur-sm z-10 interactive-hover"
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                whileHover={{ scale: 1.05, rotate: 2, y: -2 }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  <div className="flex flex-col leading-none">
                    <span className="text-xs font-medium opacity-90">100%</span>
                    <span className="text-sm font-bold">Satisfaction</span>
                    <span className="text-xs font-medium opacity-90">Guarantee</span>
                  </div>
                </div>
              </motion.div>

              {/* Pre-launch badge - better positioned to avoid overlap */}
              <motion.div
                className="absolute top-1/3 -right-6 bg-white/95 backdrop-blur-md rounded-3xl border border-green-700/20 shadow-floating p-4 z-10 interactive-hover"
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 1.4, duration: 0.6 }}
                whileHover={{ scale: 1.05, x: -2 }}
              >
                <div className="text-center min-w-[120px]">
                  <div className="text-gradient-subtle text-sm font-bold mb-1">Wellness Insights</div>
                  <div className="text-green-700 text-sm font-bold mb-2">Coming Soon</div>
                  <div className="text-xs text-slate-600 font-semibold">Twin Cities</div>
                  <div className="mt-2 px-3 py-1 bg-gradient-to-r from-green-700/10 to-green-600/15 border border-green-700/20 rounded-full">
                    <div className="text-xs text-green-700 font-bold">2026</div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Service Highlights - Fill space below video */}
            <motion.div
              className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.6 }}
            >
              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-green-700/20 shadow-lg p-4 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <ShieldCheck className="size-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Weekly Service</div>
                    <div className="text-xs text-slate-600">Consistent, reliable maintenance</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-green-700/20 shadow-lg p-4 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <Leaf className="size-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Eco-Friendly</div>
                    <div className="text-xs text-slate-600">Sustainable composting process</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-green-700/20 shadow-lg p-4 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <MapPin className="size-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Local Service</div>
                    <div className="text-xs text-slate-600">Twin Cities focused, fast response</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-green-700/20 shadow-lg p-4 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                    <Sparkles className="size-5 text-green-700" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">Smart Insights</div>
                    <div className="text-xs text-slate-600">AI-powered health monitoring</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>

      {/* Enhanced bottom trust bar with modern design */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-green-700/20 shadow-card"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.8 }}
      >
        <div className="container py-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-3 text-slate-700 hover:text-green-700 transition-colors duration-300">
              <div className="w-3 h-3 bg-green-700 rounded-full shadow-sm"></div>
              <span className="font-semibold">Licensed & Insured</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700 hover:text-green-700 transition-colors duration-300">
              <div className="w-3 h-3 bg-green-700 rounded-full shadow-sm"></div>
              <span className="font-semibold">Eco-friendly Service</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700 hover:text-green-700 transition-colors duration-300">
              <div className="w-3 h-3 bg-green-700 rounded-full shadow-sm"></div>
              <span className="font-semibold">Smart Health Insights</span>
            </div>
            <div className="flex items-center gap-3 text-slate-700 hover:text-green-700 transition-colors duration-300">
              <div className="w-3 h-3 bg-green-700 rounded-full shadow-sm"></div>
              <span className="font-semibold">Twin Cities Local</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

