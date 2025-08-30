"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface ABTestConfig {
  testId: string;
  variants: Record<string, React.ComponentType>;
  defaultVariant?: string;
}

export function useABTest({ testId, variants, defaultVariant = 'control' }: ABTestConfig) {
  const searchParams = useSearchParams();
  const [variant, setVariant] = useState<string>(defaultVariant);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check URL parameter first (for testing)
    const urlVariant = searchParams.get('layoutVariant') as keyof typeof variants;
    if (urlVariant && variants[urlVariant]) {
      setVariant(urlVariant);
      setIsLoaded(true);
      return;
    }

    // Check cookie for persistent variant
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${testId}=`))
      ?.split('=')[1];

    if (cookieValue && variants[cookieValue as keyof typeof variants]) {
      setVariant(cookieValue);
      setIsLoaded(true);
      return;
    }

    // Random assignment for new users (50/50 split)
    const randomVariant = Math.random() < 0.5 ? 'A' : 'B';
    const assignedVariant = variants[randomVariant] ? randomVariant : defaultVariant;

    setVariant(assignedVariant);

    // Set cookie for 30 days
    document.cookie = `${testId}=${assignedVariant}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;

    setIsLoaded(true);

    // Track variant assignment
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'ab_test_variant_assigned', {
        test_id: testId,
        variant: assignedVariant,
        timestamp: new Date().toISOString()
      });
    }
  }, [testId, variants, defaultVariant, searchParams]);

  const track = (eventName: string, properties: Record<string, any> = {}) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, {
        ...properties,
        test_id: testId,
        variant,
        timestamp: new Date().toISOString()
      });
    }
  };

  const Component = variants[variant as keyof typeof variants] || variants[defaultVariant];

  return {
    variant,
    Component,
    isLoaded,
    track
  };
}
