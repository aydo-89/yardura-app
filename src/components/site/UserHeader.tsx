'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  BarChart3,
  CreditCard,
  MapPin,
  Bell,
  ChevronDown,
  Shield
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

interface UserHeaderProps {
  className?: string;
}

type UserMenuItem = {
  href: string;
  label: string;
  icon: any;
  description?: string;
};

const userMenuItems: UserMenuItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: Home,
    description: 'View your service overview'
  },
  {
    href: '/account',
    label: 'Account Settings',
    icon: Settings,
    description: 'Manage your profile and preferences'
  },
  {
    href: '/dashboard#billing',
    label: 'Billing & Payments',
    icon: CreditCard,
    description: 'View invoices and payment methods'
  },
  {
    href: '/city',
    label: 'Service Areas',
    icon: MapPin,
    description: 'Explore available service locations'
  }
];

export default function UserHeader({ className }: UserHeaderProps) {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  // Debug logging
  console.log('UserHeader session:', { status, user: session?.user, isAdmin: (session as any)?.isAdmin });

  const { scrollY } = useScroll();
  const headerHeight = useTransform(scrollY, [0, 100], [80, 64]); // 80px to 64px
  const logoScale = useTransform(scrollY, [0, 100], [1, 0.9]);
  const taglineOpacity = useTransform(scrollY, [0, 50], [1, 0]);

  // Handle scroll-based state changes
  useEffect(() => {
    const updateScrollState = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY.current;
      lastScrollY.current = currentScrollY;

      // Update scrolled state
      setIsScrolled(currentScrollY > 50);
    };

    const throttledUpdate = () => {
      requestAnimationFrame(updateScrollState);
    };

    window.addEventListener('scroll', throttledUpdate, { passive: true });
    return () => window.removeEventListener('scroll', throttledUpdate);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen || isUserMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-header-menu')) {
          setIsMenuOpen(false);
          setIsUserMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, isUserMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const user = session?.user;
  const userRole = (session as any)?.userRole;
  const isAdmin = (session as any)?.isAdmin;

  if (status === 'loading') {
    return (
      <header className={cn("w-full bg-white/95 backdrop-blur-sm border-b border-slate-200/60", className)}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className="animate-pulse bg-slate-200 h-8 w-32 rounded"></div>
        </div>
      </header>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <motion.header
      className={cn("w-full bg-white/95 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50 transition-all duration-300", className)}
      style={{ height: headerHeight }}
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-center justify-between"
          style={{ height: headerHeight }}
        >

          {/* Logo and Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="relative"
              style={{ scale: logoScale }}
            >
              <Image
                src="/yeller_icon_centered.png"
                alt="Yeller logo"
                width={40}
                height={40}
                className="rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-200 transform scale-125"
              />
              {isAdmin && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full border-2 border-white flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </motion.div>
            <motion.div
              className="hidden sm:block overflow-hidden"
              animate={{
                width: isScrolled ? 'auto' : 'auto',
                opacity: 1,
              }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="font-black text-xl bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent leading-tight"
                animate={{
                  fontSize: isScrolled ? '1.125rem' : '1.25rem', // 18px to 20px
                }}
                transition={{ duration: 0.3 }}
              >
                Yeller
              </motion.div>
              <motion.div
                className="text-xs text-slate-500 -mt-0.5 leading-tight flex items-center gap-1"
                style={{ opacity: taglineOpacity }}
                animate={{
                  height: isScrolled ? 0 : 'auto',
                  marginTop: isScrolled ? 0 : '-2px',
                }}
                transition={{ duration: 0.3 }}
              >
                <span>by Yardura</span>
                <img
                  src="/yardura-logo.png"
                  alt="Yardura"
                  className="h-4 w-4 rounded-sm object-contain"
                />
                {isAdmin ? 'Admin Portal' : 'My Services'}
              </motion.div>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {userMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all duration-200 group"
              >
                <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                {item.label}
              </Link>
            ))}

            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all duration-200 group"
              >
                <Shield className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Admin Panel
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3 user-header-menu">
            {/* Quick Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-brand-600 hover:bg-brand-50"
              >
                <Bell className="w-4 h-4" />
              </Button>
            </div>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors duration-200 group"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">
                    {user.name || 'User'}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    {isAdmin && <Shield className="w-3 h-3 text-amber-500" />}
                    {userRole === 'ADMIN' ? 'Administrator' : 'Customer'}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-slate-400 transition-transform duration-200",
                  isUserMenuOpen && "rotate-180"
                )} />
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200/60 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{user.name || 'User'}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                          {isAdmin && (
                            <div className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-1">
                              <Shield className="w-3 h-3" />
                              Administrator
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      {userMenuItems.map((item, index) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors duration-200 group"
                        >
                          <item.icon className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                          <div>
                            <div className="font-medium">{item.label}</div>
                            {item.description && (
                              <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                            )}
                          </div>
                        </Link>
                      ))}

                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors duration-200 group"
                        >
                          <Shield className="w-4 h-4 text-amber-500 group-hover:text-amber-600 transition-colors" />
                          <div>
                            <div className="font-medium">Admin Panel</div>
                            <div className="text-xs text-amber-600 mt-0.5">Manage system settings</div>
                          </div>
                        </Link>
                      )}

                      <div className="border-t border-slate-100 mt-2 pt-2">
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200 w-full text-left group"
                        >
                          <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors duration-200"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-sm"
            >
              <div className="py-4 space-y-2">
                {userMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors duration-200"
                  >
                    <item.icon className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-sm text-slate-500">{item.description}</div>
                      )}
                    </div>
                  </Link>
                ))}

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors duration-200"
                  >
                    <Shield className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="font-medium">Admin Panel</div>
                      <div className="text-sm text-amber-600">Manage system settings</div>
                    </div>
                  </Link>
                )}

                <div className="border-t border-slate-200 pt-2 mt-4">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-200 w-full text-left"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
