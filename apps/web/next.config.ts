import type { NextConfig } from 'next'
import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
})

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@symph-crm/database'],
  async rewrites() {
    // In production, Next.js server proxies /api/* to the NestJS backend.
    // API_URL must be set as a Docker build-arg (baked into routes-manifest.json at
    // build time) AND as a Cloud Run env var (for the standalone runtime).
    const apiUrl = process.env.API_URL || 'http://localhost:4000'
    return [
      // Google Calendar integration routes live in NestJS under /api/auth/google-calendar/*.
      // Must come BEFORE the NextAuth catch-all rule below — otherwise /api/auth/google-calendar/*
      // matches /api/auth/:path* first and hits the NextAuth handler (returning 400 Bad Request).
      {
        source: '/api/auth/google-calendar/:path*',
        destination: `${apiUrl}/api/auth/google-calendar/:path*`,
      },
      // NextAuth routes (/api/auth/*) must NOT be proxied to the NestJS backend.
      // They are handled by the Next.js route handler at app/api/auth/[...nextauth]/route.ts.
      // Self-referential rewrites in Next.js are non-recursive — they resolve to the
      // file system route rather than looping.
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
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
