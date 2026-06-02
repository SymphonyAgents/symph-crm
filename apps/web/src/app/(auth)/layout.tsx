'use client'

import { AuthUserProvider } from '@/lib/auth-context'

// Auth layout mirrors (dashboard)/layout.tsx so login/onboarding pages
// read the same backend-owned auth session.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthUserProvider>{children}</AuthUserProvider>
  )
}
