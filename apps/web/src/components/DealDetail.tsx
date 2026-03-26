'use client'

import { EmptyState } from './EmptyState'

type DealDetailProps = {
  dealId: number
  onBack: () => void
  onOpenDeal: (id: number) => void
}

export function DealDetail({ dealId: _dealId, onBack, onOpenDeal: _onOpenDeal }: DealDetailProps) {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover mb-3 transition-colors duration-150 w-fit"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}><polyline points="15 18 9 12 15 6" /></svg>
        Back to Pipeline
      </button>

      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          title="Deal not found"
          description="This deal doesn't exist yet. Deals will be loaded from the database once connected."
          action={
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors duration-150"
            >
              Back to Pipeline
            </button>
          }
        />
      </div>
    </div>
  )
}
