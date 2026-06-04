'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { ProgressProvider } from '@bprogress/next/app'
import { PostHogProvider } from '@/components/PostHogProvider'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' || resolvedTheme === 'midnight' ? 'dark' : 'light'}
      toastOptions={{
        style: {
          fontSize: '13px',
          borderRadius: '8px',
        },
        classNames: {
          toast: 'border border-black/[.08] dark:border-white/[.1] shadow-lg',
          success: 'bg-card text-slate-900 dark:text-white',
          error: 'bg-card text-red-600 dark:text-red-400',
          info: 'bg-card text-slate-900 dark:text-white',
          warning: 'bg-card text-amber-600 dark:text-amber-400',
          description: 'text-slate-500 dark:text-slate-400',
        },
      }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <PostHogProvider>
      <ThemeProvider attribute="class" defaultTheme="light" themes={['light', 'dark', 'midnight']} disableTransitionOnChange>
        <ProgressProvider
          height="2px"
          color="var(--primary)"
          options={{ showSpinner: false }}
          shallowRouting
        >
          <QueryClientProvider client={queryClient}>
            {children}
            <ThemedToaster />
          </QueryClientProvider>
        </ProgressProvider>
      </ThemeProvider>
    </PostHogProvider>
  )
}
