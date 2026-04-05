'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar } from './Avatar'
import { api } from '@/lib/api'
import { API_BASE } from '@/lib/constants'
import { queryKeys } from '@/lib/query-keys'
import { useGetCalendarStatus } from '@/lib/hooks/queries'
import { cn } from '@/lib/utils'
import {
  Check,
  Loader2,
  RefreshCw,
  Link2Off,
  ChevronRight,
  Mail,
  Phone,
  MessageCircle,
} from 'lucide-react'

// ─── Google icon (brand SVG) ─────────────────────────────────────────────────

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Placeholder app card ────────────────────────────────────────────────────

function ComingSoonApp({
  icon,
  name,
  description,
}: {
  icon: React.ReactNode
  name: string
  description: string
}) {
  return (
    <div className="flex items-center gap-4 py-4 px-4 rounded-xl border border-black/[.06] dark:border-white/[.06] bg-slate-50/50 dark:bg-white/[.02] opacity-50">
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[.06] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-ssm font-semibold text-slate-900 dark:text-white">{name}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <span className="text-atom font-semibold text-slate-400 bg-slate-100 dark:bg-white/[.06] px-2 py-1 rounded-md">
        Coming soon
      </span>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Settings() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const user = session?.user
  const userId = (session?.user as { id?: string })?.id

  const { data: calendarStatus, isLoading: statusLoading } = useGetCalendarStatus()
  const [disconnecting, setDisconnecting] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Handle ?connected=true or ?oauth_error=... from OAuth callback
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const oauthError = params.get('oauth_error')

    if (connected === 'true') {
      setBanner({ type: 'success', message: 'Google account connected successfully.' })
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.status })
    } else if (oauthError) {
      setBanner({ type: 'error', message: `Connection failed: ${oauthError}` })
    }

    if (connected || oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('oauth_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [queryClient])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await api.delete('/auth/google-calendar/disconnect')
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.status })
      setBanner({ type: 'success', message: 'Google account disconnected.' })
    } catch {
      setBanner({ type: 'error', message: 'Failed to disconnect. Please try again.' })
    } finally {
      setDisconnecting(false)
    }
  }

  const connectUrl = `${API_BASE}/auth/google-calendar/connect?userId=${encodeURIComponent(userId ?? '')}&returnTo=%2Fsettings`

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Banner */}
      {banner && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl text-ssm font-medium animate-in fade-in-0 slide-in-from-top-1 duration-200',
          banner.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/[.1] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
            : 'bg-red-50 dark:bg-red-500/[.1] text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
        )}>
          {banner.type === 'success' ? <Check size={14} /> : null}
          {banner.message}
          <button
            onClick={() => setBanner(null)}
            className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400 mb-3">Profile</h2>
        <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] p-4 flex items-center gap-4">
          {user?.image ? (
            <img src={user.image} alt="" className="w-14 h-14 rounded-full shrink-0 ring-2 ring-black/[.06] dark:ring-white/[.08]" />
          ) : (
            <Avatar name={user?.name || '?'} size={56} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sbase font-semibold text-slate-900 dark:text-white truncate">
              {user?.name || '—'}
            </div>
            <div className="text-ssm text-slate-400 truncate mt-0.5">{user?.email || '—'}</div>
            <div className="mt-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-atom font-semibold bg-primary/[.08] dark:bg-primary/[.12] text-primary">
                Account Manager
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Connected Apps ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400 mb-3">Connected Apps</h2>
        <div className="space-y-2">

          {/* Google */}
          <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] flex items-center justify-center shrink-0 shadow-sm">
                <GoogleIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-ssm font-semibold text-slate-900 dark:text-white">Google</div>
                {statusLoading ? (
                  <div className="text-xs text-slate-400 mt-0.5">Checking status...</div>
                ) : calendarStatus?.connected ? (
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    Connected as <span className="text-slate-600 dark:text-slate-300 font-medium">{calendarStatus.googleEmail}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5">Calendar · Gmail · Not connected</div>
                )}
              </div>

              {statusLoading ? (
                <Loader2 size={16} className="text-slate-300 animate-spin shrink-0" />
              ) : calendarStatus?.connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-400/20 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Link2Off size={12} />
                  )}
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <a
                  href={connectUrl}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
                >
                  Connect
                  <ChevronRight size={12} />
                </a>
              )}
            </div>

            {/* Re-auth nudge if needsReconnect */}
            {calendarStatus?.connected && (calendarStatus as any).needsReconnect && (
              <div className="mt-3 pt-3 border-t border-black/[.04] dark:border-white/[.06] flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <RefreshCw size={12} />
                <span>New permissions required. Please disconnect and reconnect to enable all features.</span>
              </div>
            )}

            {/* Scope info */}
            {calendarStatus?.connected && (
              <div className="mt-3 pt-3 border-t border-black/[.04] dark:border-white/[.06] flex flex-wrap gap-1.5">
                {['Gmail read/modify', 'Gmail send', 'Calendar events'].map(s => (
                  <span key={s} className="inline-flex items-center gap-1 text-atom font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.05] text-slate-500 dark:text-slate-400">
                    <Check size={10} className="text-emerald-500" />
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Coming soon placeholders */}
          <ComingSoonApp
            icon={<Phone size={18} className="text-slate-400" />}
            name="Viber"
            description="Send and receive Viber messages"
          />
          <ComingSoonApp
            icon={<MessageCircle size={18} className="text-slate-400" />}
            name="WhatsApp"
            description="Connect your WhatsApp Business account"
          />
          <ComingSoonApp
            icon={<Mail size={18} className="text-slate-400" />}
            name="Messenger"
            description="Facebook Messenger integration"
          />
        </div>
      </section>
    </div>
  )
}
