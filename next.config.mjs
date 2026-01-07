/** @type {import('next').NextConfig} */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const path = require("path");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // Run lint separately (CI / npm run lint). This keeps `next build` faster and avoids
    // the "Linting and checking validity of types..." pause that can look like a hang.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We run `tsc --noEmit` ourselves in `npm run build` (see package.json).
    // Next's additional type-check can occasionally hang; skip it to keep deploys reliable.
    ignoreBuildErrors: true,
  },

  // Next performs "output file tracing" during build ("Collecting build traces ...").
  // In this repo we deploy the full app directory to the server (not standalone), so
  // tracing does not need to walk huge data directories. Excluding them prevents
  // multi-hour hangs on some machines.
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingExcludes: {
    "*": [
      "data/**",
      "docs/**",
      "infra/**",
      "jobs/**",
      "scripts/**",
      "restore_backup_*/**",
      "backup_*/**",
    ],
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"], // AVIF/WebP fallbacks for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xyhnxaukpoftldcfldxx.supabase.co",
        port: "",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Bundle analysis
  webpack: (config, { isServer }) => {
    // Optimize bundle splits
    if (!isServer) {
      if (config.optimization && typeof config.optimization.splitChunks === "object") {
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
      }

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
        "pg-native": false,
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

export default withBundleAnalyzer(nextConfig);
