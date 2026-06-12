import { BACKEND_API_URL } from '@/lib/backend-url'

function resolveReturnTo(value: string | undefined): string {
  if (!value) return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return value
}

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const params = await searchParams
  const returnTo = resolveReturnTo(params?.returnTo)
  const loginUrl = `${BACKEND_API_URL}/auth/google?returnTo=${encodeURIComponent(returnTo)}`

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface-alt">
      <div className="w-full max-w-[360px] mx-4">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-extrabold text-white tracking-tight"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            S
          </div>
          <div>
            <div className="text-base font-bold text-foreground tracking-tight">Symph CRM</div>
            <div className="text-xxs text-text-faint">Sales Pipeline</div>
          </div>
        </div>

        <div className="bg-card rounded-md border border-border shadow-sm p-6">
          <h1 className="text-base font-semibold text-foreground text-center mb-1">
            Sign in
          </h1>
          <p className="text-ssm text-muted-foreground text-center mb-6">
            Use your Symph Google account to continue
          </p>

          <a
            href={loginUrl}
            className="w-full flex items-center justify-center gap-2.5 bg-card hover:bg-surface-alt dark:hover:bg-[#2a2a2f] border border-border rounded-lg px-4 py-2.5 text-ssm font-medium text-foreground transition-colors duration-150 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </a>
        </div>

        <p className="text-xxs text-text-faint text-center mt-4">
          Symph internal use only
        </p>
      </div>
    </div>
  )
}
