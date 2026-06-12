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
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        style: {
          fontSize: '13px',
          borderRadius: '8px',
        },
        classNames: {
          toast: 'border border-border shadow-lg',
          success: 'bg-card text-foreground',
          error: 'bg-card text-red-600 dark:text-red-400',
          info: 'bg-card text-foreground',
          warning: 'bg-card text-amber-600 dark:text-amber-400',
          description: 'text-muted-foreground',
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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem themes={['light', 'dark', 'midnight']}>
        <ProgressProvider
          height="2px"
          color="#1547e6"
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
