import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

// PWA is disabled: @ducanh2912/next-pwa@10 generates async cacheWillUpdate code
// that references _async_to_generator without bundling the helper, crashing the SW.
// Re-enable once the package fixes the compilation issue or we upgrade to a fixed version.
const withPWA = withPWAInit({
  dest: 'public',
  disable: true,
})

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@symph-crm/database', '@symph-crm/shared'],
  async headers() {
    // In dev, the browser hits http://localhost:4000 directly (apps/web/src/lib/api.ts
    // hardcodes that base). It must be allowed in connect-src or the browser blocks
    // the request before it leaves. Prod uses /api/* via Next.js rewrites — same-origin.
    const devConnect = process.env.NODE_ENV === 'production'
      ? ''
      : ' http://localhost:4000 ws://localhost:3000'
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com https://*.posthog.com",
              `connect-src 'self' https://us.i.posthog.com https://*.posthog.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.supabase.co${devConnect}`,
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.supabase.co",
              "media-src 'self' blob: https://*.supabase.co",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async rewrites() {
    // In production, Next.js server proxies /api/* to the NestJS backend.
    // API_URL must be set as a Docker build-arg (baked into routes-manifest.json at
    // build time) AND as a Cloud Run env var (for the standalone runtime).
    const apiUrl = process.env.API_URL || 'http://localhost:4000'
    return [
      // Backend-owned auth lives in NestJS. Keep this before the generic /api/* proxy.
      {
        source: '/api/auth/:path*',
        destination: `${apiUrl}/api/auth/:path*`,
      },
      // All other /api/* routes are proxied to the NestJS backend.
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default withPWA(nextConfig)
