import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

type NotFoundPageProps = {
  title?: string
  description?: string
  href?: string
  actionLabel?: string
}

export function NotFoundPage({
  title = 'Page not found',
  description = 'The page you requested does not exist or you do not have access to it.',
  href = '/',
  actionLabel = 'Go home',
}: NotFoundPageProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-secondary text-slate-400">
          <SearchX size={20} strokeWidth={1.6} />
        </div>
        <h1 className="mt-4 text-base font-semibold text-foreground">{title}</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <Button asChild className="mt-4">
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
