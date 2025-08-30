/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'], // Tree-shake Lucide icons
  },
  eslint: {
    // Unblock CI/builds while we stabilize lint config
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'], // AVIF/WebP fallbacks for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Bundle analysis
  webpack: (config, { isServer }) => {
    // Optimize bundle splits
    if (!isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        // Separate vendor chunks for better caching
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // Separate Framer Motion for better caching
        'framer-motion': {
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          name: 'framer-motion',
          chunks: 'all',
          priority: 20,
        },
      };
    }

    return config;
  },

  // Headers for better performance and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Compression
  compress: true,

  // Reduce bundle size (Next.js 15: swcMinify is always enabled; option removed)
};

module.exports = withBundleAnalyzer(nextConfig);
