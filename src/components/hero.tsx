'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { Leaf, Shield, ShieldCheck, Sparkles, Star, MapPin, Users } from 'lucide-react';
import Image from 'next/image';

import Reveal from '@/components/Reveal';
import { useReducedMotionSafe } from '@/hooks/useReducedMotionSafe';
import { splitHeadline, dur, ease, spring } from '@/lib/motion/presets';

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
      className="bg-gradient-to-br from-accent-soft/60 via-white to-accent-soft/30 border-b relative overflow-hidden"
    >
      {/* Enhanced background pattern with subtle animation */}
      <div className="absolute inset-0 opacity-15">
        <div
          className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22%237BB369%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M30%2030c0-8.3-6.7-15-15-15s-15%206.7-15%2015%206.7%2015%2015%2015%2015-6.7%2015-15zm-3%200c0%206.6-5.4%2012-12%2012s-12-5.4-12-12%205.4-12%2012-12%2012%205.4%2012%2012z%22/%3E%3C/g%3E%3C/svg%3E')]"
          style={{
            animation: prefersReducedMotion ? 'none' : 'pulse 8s infinite',
          }}
        />
      </div>

      {/* Parallax floating gradient orbs */}
      <motion.div
        className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-accent/20 to-accent-soft/40 rounded-full blur-xl"
        style={{
          y: prefersReducedMotion ? 0 : blob1Y,
          opacity: 0.6,
        }}
      />
      <motion.div
        className="absolute bottom-32 left-16 w-24 h-24 bg-gradient-to-br from-accent-soft/30 to-accent/15 rounded-full blur-lg"
        style={{
          y: prefersReducedMotion ? 0 : blob2Y,
          opacity: 0.4,
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/4 w-16 h-16 bg-gradient-to-br from-accent/25 to-accent-soft/50 rounded-full blur-md"
        style={{
          y: prefersReducedMotion ? 0 : blob3Y,
          opacity: 0.3,
        }}
      />

      <div
        className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center relative z-10"
        onMouseMove={handleMouseMove}
      >
        <Reveal>
          <div>
            {/* Trust signals - realistic messaging */}
            <motion.div
              className="flex items-center gap-2 mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: dur.base, ease: ease.emphasized }}
            >
              <div className="flex items-center gap-1 text-accent">
                <Shield className="size-4" />
              </div>
              <span className="text-sm text-slate-600">
                Licensed • Insured • Eco-friendly • Twin Cities Local
              </span>
            </motion.div>

            {/* Split headline reveal */}
            <motion.div
              className="text-4xl md:text-5xl font-extrabold leading-tight md:leading-[1.25] text-ink"
              variants={splitHeadline.container}
              initial="initial"
              animate="animate"
            >
              <motion.span className="block" variants={splitHeadline.line}>
                Clean yard.{' '}
                <motion.span
                  className="inline-flex items-center gap-2 align-middle"
                  variants={splitHeadline.line}
                >
                  <span className="bg-gradient-to-r from-accent to-accent/80 bg-clip-text text-transparent pb-1">
                    Smarter Insights.
                  </span>
                </motion.span>
              </motion.span>
              <motion.span
                className="block"
                variants={splitHeadline.line}
                transition={{ delay: 0.1 }}
              >
                Less landfill.
              </motion.span>
            </motion.div>
            <p className="mt-4 text-lg text-slate-600">
              Yardura is the Twin Cities' tech-enabled, eco-friendly dog waste removal service.
              Weekly scooping at market pricing — plus smart trend alerts on your pup's poop health:
              <span className="text-brand-700 font-medium">
                {' '}
                Color, Consistency, Content (3 C's) and more.
              </span>{' '}
              <span className="inline-flex items-center whitespace-nowrap align-middle px-2 py-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800 border border-brand-300">
                Coming soon
              </span>
            </p>

            {/* Service area highlight */}
            <div className="mt-4 flex items-center gap-2 text-brand-700">
              <MapPin className="size-4" />
              <span className="text-sm font-medium">
                Serving South Minneapolis, Richfield, Edina, Bloomington. Coming soon to St. Cloud!
              </span>
            </div>

            {/* Enhanced CTAs with magnetic hover and shimmer */}
            <motion.div
              className="mt-6 flex flex-wrap gap-3"
              onHoverStart={() => setIsHovered(true)}
              onHoverEnd={() => setIsHovered(false)}
            >
              <motion.a
                href="/quote"
                data-analytics="cta_hero_get_quote"
                className="relative px-6 py-3 rounded-xl bg-accent text-white font-semibold shadow-soft overflow-hidden group"
                style={{
                  x: prefersReducedMotion ? 0 : buttonX,
                  y: prefersReducedMotion ? 0 : buttonY,
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                />
                <span className="relative z-10">Get My Quote</span>
              </motion.a>

              <motion.a
                href="#how"
                data-analytics="hero_how_it_works"
                className="px-6 py-3 rounded-xl border border-accent hover:bg-accent-soft font-semibold transition-all duration-200"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={spring.snappy}
              >
                How it works
              </motion.a>
            </motion.div>

            {/* Trust indicators */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand-600" />
                <span>No contracts</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-600" />
                <span>Text alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="size-4 text-brand-600" />
                <span>Eco composting</span>
              </div>
            </div>

            {/* Customer testimonial preview */}
            <div className="mt-6 p-4 bg-white/70 rounded-xl border border-brand-200">
              <div className="flex items-start gap-3">
                <div className="size-10 bg-brand-100 rounded-full flex items-center justify-center">
                  <Users className="size-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-700 italic">
                    "The mission of using data and insights to help dog owners is really cool. Clean
                    yard every week and I love supporting an eco-friendly service that keeps waste
                    out of landfills."
                  </p>
                  <p className="text-xs text-slate-500 mt-1">- Sarah M., Richfield</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="relative">
            <div className="rounded-2xl border shadow-soft p-4 bg-white relative overflow-hidden">
              <Image
                src="/modern_yard.png"
                alt="Clean Minneapolis yard after professional dog waste removal service - lush green grass and beautiful landscaping"
                width={600}
                height={400}
                className="rounded-xl w-full h-auto object-cover"
                priority // LCP optimization
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAoACgDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAMEB//EACUQAAIBAwMEAwEBAAAAAAAAAAECAwAEEQUSITFBURNhcZEigf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8A4+iiigAooooAKKKKACiiigD/2Q=="
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>

            {/* Enhanced stats card */}
            <div className="absolute -bottom-5 -left-5 bg-white rounded-xl border shadow-soft p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-brand-800">250+ lbs</div>
                <div className="text-xs text-slate-600">kept out of landfill per dog per year</div>
                <div className="mt-2 text-xs text-brand-600 font-medium">
                  Join our eco mission! 🌱
                </div>
              </div>
            </div>

            {/* Service guarantee badge */}
            <div className="absolute -top-3 -right-3 bg-accent text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              100% Satisfaction Guaranteed
            </div>
          </div>
        </Reveal>
      </div>

      {/* Bottom trust bar */}
      <div className="bg-white/80 border-t">
        <div className="container py-4">
          <div className="flex items-center justify-center gap-6 text-xs text-muted">
            <span>🛡️ Licensed & insured</span>
            <span>•</span>
            <span>💚 Eco-friendly service</span>
            <span>•</span>
            <span>📱 Smart health insights</span>
            <span>•</span>
            <span>🏠 Twin Cities local</span>
          </div>
        </div>
      </div>
    </section>
  );
}
