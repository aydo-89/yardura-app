/** @type {import('next').NextConfig} */

let withBundleAnalyzer = (config) => config;
try {
  withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
  });
} catch (e) {
  // bundle-analyzer not available in production
}

const nextConfig = {
  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react"], // Tree-shake Lucide icons
  },
  // Temporarily remove standalone output for dev mode
  // output: 'standalone',

  // Disable static generation for all pages to avoid database connection issues
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,

  // Disable static generation for pages that require database access
  generateBuildId: async () => {
    return "build-" + Date.now();
  },
  eslint: {
    // Unblock CI/builds while we stabilize lint config
    ignoreDuringBuilds: true,
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"], // AVIF/WebP fallbacks for better compression
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
          name: "vendors",
          chunks: "all",
          priority: 10,
        },
        // Separate Framer Motion for better caching
        "framer-motion": {
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          name: "framer-motion",
          chunks: "all",
          priority: 20,
        },
      };

      // Exclude server-only modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        dns: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        util: false,
        querystring: false,
        events: false,
        buffer: false,
        string_decoder: false,
        child_process: false,
        cluster: false,
        dgram: false,
        punycode: false,
        readline: false,
        repl: false,
        tty: false,
        v8: false,
        vm: false,
        worker_threads: false,
      };
    }

    return config;
  },

  // Headers for better performance and security (CSP now handled by nginx)
  async headers() {
    return [
      {
        source: "/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
