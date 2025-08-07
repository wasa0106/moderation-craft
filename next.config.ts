import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* CSS and build optimization */
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  /* Image optimization */
  images: {
    formats: ["image/avif", "image/webp"],
  },
  
  /* Webpack configuration for DuckDB WASM */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    // Add rule for .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    // Add rule for worker files
    config.module.rules.push({
      test: /\.worker\.js$/,
      use: { loader: 'worker-loader' },
    });
    
    return config;
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
