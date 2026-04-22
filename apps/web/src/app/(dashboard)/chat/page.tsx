import { Chat } from '@/components/Chat'
import { Suspense } from 'react'

/**
 * Suspense is required because Chat uses useSearchParams().
 * Without it, Next.js can suspend the component during render
 * transitions, leaving the UI visible but with React's event
 * system in a deferred state — buttons appear but don't fire.
 */
export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  )
}
