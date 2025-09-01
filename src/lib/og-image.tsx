import { ImageResponse } from 'next/og';

import React from 'react';

// Font loading for OG images
const loadFonts = async () => {
  const [interRegular, interBold] = await Promise.all([
    fetch(
      new URL('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2')
    ).then(res => res.arrayBuffer()),
    fetch(
      new URL('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2')
    ).then(res => res.arrayBuffer()),
  ]);

  return [
    {
      name: 'Inter',
      data: interRegular,
      style: 'normal' as const,
      weight: 400 as const,
    },
    {
      name: 'Inter',
      data: interBold,
      style: 'normal' as const,
      weight: 700 as const,
    },
  ];
};

// OG Image templates
export const generateOGImage = async (
  title: string,
  subtitle?: string,
  type: 'homepage' | 'insights' | 'quote' | 'facts' = 'homepage'
): Promise<ImageResponse> => {
  const fonts = await loadFonts();

  const getTemplateConfig = () => {
    switch (type) {
      case 'insights':
        return {
          bgGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          accentColor: '#ecfdf5',
          titleColor: '#ffffff',
          subtitleColor: '#ecfdf5',
          badge: 'Health Insights',
          badgeColor: '#065f46',
        };
      case 'quote':
        return {
          bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          accentColor: '#eff6ff',
          titleColor: '#ffffff',
          subtitleColor: '#dbeafe',
          badge: 'Get Quote',
          badgeColor: '#1e40af',
        };
      case 'facts':
        return {
          bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          accentColor: '#fffbeb',
          titleColor: '#ffffff',
          subtitleColor: '#fef3c7',
          badge: 'Service Facts',
          badgeColor: '#92400e',
        };
      default: // homepage
        return {
          bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          accentColor: '#ecfdf5',
          titleColor: '#ffffff',
          subtitleColor: '#d1fae5',
          badge: 'Dog Waste Removal',
          badgeColor: '#064e3b',
        };
    }
  };

  const config = getTemplateConfig();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: config.bgGradient,
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M30 30c0-8.3-6.7-15-15-15s-15 6.7-15 15 6.7 15 15 15 15-6.7 15-15zm-3 0c0 6.6-5.4 12-12 12s-12-5.4-12-12 5.4-12 12-12 12 5.4 12 12z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            opacity: 0.1,
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            maxWidth: '800px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Badge */}
          {config.badge && (
            <div
              style={{
                backgroundColor: config.badgeColor,
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {config.badge}
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 700,
              color: config.titleColor,
              margin: '0 0 16px 0',
              lineHeight: 1.1,
              textAlign: 'center',
              maxWidth: '700px',
              wordWrap: 'break-word',
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              style={{
                fontSize: '28px',
                fontWeight: 400,
                color: config.subtitleColor,
                margin: '0',
                lineHeight: 1.3,
                textAlign: 'center',
                maxWidth: '600px',
                opacity: 0.9,
              }}
            >
              {subtitle}
            </p>
          )}

          {/* Yardura logo/brand */}
          <div
            style={{
              position: 'absolute',
              bottom: '30px',
              right: '30px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: config.accentColor,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: config.badgeColor,
              }}
            >
              Y
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: config.titleColor,
              }}
            >
              Yardura
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );
};

// Utility functions for different page types
export const generateHomepageOG = () =>
  generateOGImage(
    'Clean yard. Smarter Insights.',
    'Tech-enabled, eco-friendly dog waste removal with health insights',
    'homepage'
  );

export const generateQuoteOG = () =>
  generateOGImage(
    'Get Your Dog Waste Removal Quote',
    'Weekly service starting at $20/visit. Eco-friendly & professional.',
    'quote'
  );

export const generateInsightsOG = (title: string, excerpt?: string) =>
  generateOGImage(
    title,
    excerpt || 'Dog health insights and eco-friendly waste management tips',
    'insights'
  );

export const generateFactsOG = () =>
  generateOGImage(
    'Yardura Service Facts',
    'Licensing, insurance, service areas, and eco-friendly practices',
    'facts'
  );

// Type definitions
export interface OGImageOptions {
  title: string;
  subtitle?: string;
  type?: 'homepage' | 'insights' | 'quote' | 'facts';
  customConfig?: {
    bgGradient?: string;
    accentColor?: string;
    titleColor?: string;
    subtitleColor?: string;
    badge?: string;
    badgeColor?: string;
  };
}

// Advanced OG image generator with custom options
export const generateCustomOGImage = async (options: OGImageOptions): Promise<ImageResponse> => {
  const fonts = await loadFonts();

  const defaultConfig = {
    bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    accentColor: '#ecfdf5',
    titleColor: '#ffffff',
    subtitleColor: '#d1fae5',
    badge: 'Yardura',
    badgeColor: '#064e3b',
    ...options.customConfig,
  };

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: defaultConfig.bgGradient,
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M30 30c0-8.3-6.7-15-15-15s-15 6.7-15 15 6.7 15 15 15 15-6.7 15-15zm-3 0c0 6.6-5.4 12-12 12s-12-5.4-12-12 5.4-12 12-12 12 5.4 12 12z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            opacity: 0.1,
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            maxWidth: '800px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Badge */}
          {defaultConfig.badge && (
            <div
              style={{
                backgroundColor: defaultConfig.badgeColor,
                color: 'white',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {defaultConfig.badge}
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 700,
              color: defaultConfig.titleColor,
              margin: '0 0 16px 0',
              lineHeight: 1.1,
              textAlign: 'center',
              maxWidth: '700px',
              wordWrap: 'break-word',
            }}
          >
            {options.title}
          </h1>

          {/* Subtitle */}
          {options.subtitle && (
            <p
              style={{
                fontSize: '28px',
                fontWeight: 400,
                color: defaultConfig.subtitleColor,
                margin: '0',
                lineHeight: 1.3,
                textAlign: 'center',
                maxWidth: '600px',
                opacity: 0.9,
              }}
            >
              {options.subtitle}
            </p>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );
};
