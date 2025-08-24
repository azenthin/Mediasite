/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only apply dev optimizations in development
  ...(process.env.NODE_ENV === 'development' && {
    experimental: {
      optimizeCss: false,
    },
    webpack: (config, { dev }) => {
      if (dev) {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
        };
      }
      return config;
    },
  }),
  
  // Production optimizations
  images: {
    domains: ['images.unsplash.com', 'picsum.photos', 'placehold.co'],
    formats: ['image/webp', 'image/avif'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://* https://picsum.photos https://placehold.co; media-src 'self' https://*; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;