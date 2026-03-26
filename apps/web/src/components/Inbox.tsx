'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type FilterTab = 'all' | 'unread' | 'tagged'

export function Inbox({ onOpenDeal: _onOpenDeal }: { onOpenDeal: (id: number) => void }) {
  const [filter, setFilter] = useState<FilterTab>('all')

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left panel — thread list */}
      <div className="w-[340px] shrink-0 border-r border-black/[.06] flex flex-col h-full">
        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300"
              width={13} height={13} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search messages..."
              disabled
              className="w-full pl-8 pr-3 py-[7px] text-[12.5px] bg-slate-50 border border-black/[.07] rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-ring focus:border-primary/40 disabled:cursor-default transition-colors"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-3 pb-2 shrink-0 flex gap-1">
          {(['all', 'unread', 'tagged'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                'px-3 py-1 rounded-full text-[11.5px] font-medium capitalize transition-colors',
                filter === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Empty thread list */}
        <div className="flex-1 flex flex-col items-center justify-center pb-12 px-6 gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-[13px] font-semibold text-slate-700 mb-1">No messages</div>
            <div className="text-[11.5px] text-slate-400 leading-relaxed">
              Emails and messages linked<br />to deals will appear here
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — thread reader */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-50/50">
        <div className="w-12 h-12 rounded-full bg-white border border-black/[.06] shadow-sm flex items-center justify-center">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="text-center">
          <div className="text-[13px] font-medium text-slate-400">Select a thread to read</div>
        </div>
      </div>
    </div>
  )
}
