import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* CSS and build optimization */
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  /* Production optimizations */
  swcMinify: true,
  
  /* Image optimization */
  images: {
    formats: ["image/avif", "image/webp"],
  },
  
  /* Headers for better caching */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  
  /* Environment-specific configuration */
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.NODE_ENV,
  },
};

export default nextConfig;
