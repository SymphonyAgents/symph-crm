import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@symph-crm/database'],
  async rewrites() {
    // In production, Next.js server proxies /api/* to the NestJS backend.
    // API_URL is a server-side runtime env var (not NEXT_PUBLIC_) — set in Cloud Run.
    const apiUrl = process.env.API_URL || 'http://localhost:4000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
