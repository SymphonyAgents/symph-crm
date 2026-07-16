import { redirect } from 'next/navigation'

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  if (params.view === 'leads') redirect('/leads')

  const next = new URLSearchParams()
  for (const key of ['tab', 'item', 'stage']) {
    const value = params[key]
    if (typeof value === 'string') next.set(key, value)
  }
  const query = next.toString()
  redirect(query ? `/deals?${query}` : '/deals')
}
