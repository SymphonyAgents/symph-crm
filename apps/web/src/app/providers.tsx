'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { useState } from 'react'
import { TopLoader } from '@/components/TopLoader'

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
          toast: 'border border-black/[.08] dark:border-white/[.1] shadow-lg',
          success: 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white',
          error: 'bg-white dark:bg-[#1e1e21] text-red-600 dark:text-red-400',
          info: 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white',
          warning: 'bg-white dark:bg-[#1e1e21] text-amber-600 dark:text-amber-400',
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TopLoader />
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
