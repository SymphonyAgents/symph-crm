'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { ApiPartnerDealGroup, ApiPartnerGroup } from '@/lib/types'

type PartnerGroupMultiSelectProps = {
  groups: Array<ApiPartnerGroup | ApiPartnerDealGroup>
  selected: string[]
  onChange: (next: string[]) => void
}

export function PartnerGroupMultiSelect({ groups, selected, onChange }: PartnerGroupMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedGroups = groups.filter(group => selected.includes(group.id))

  function toggleGroup(groupId: string) {
    onChange(selected.includes(groupId)
      ? selected.filter(id => id !== groupId)
      : [...selected, groupId])
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="eyebrow-label">
        Partner access <span className="text-slate-400 normal-case font-normal">groups</span>
      </label>
      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGroups.map(group => (
            <span
              key={group.id}
              className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pl-2 pr-1 text-xxs font-medium text-foreground"
            >
              {group.name}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-skeleton hover:text-slate-600"
                aria-label={`Remove ${group.name}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-secondary px-3 text-left text-ssm text-foreground transition-colors hover:bg-surface-alt"
          >
            <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
              {selected.length === 0 ? 'Select partner groups...' : `${selected.length} group${selected.length === 1 ? '' : 's'} selected`}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search partner groups..." className="text-ssm" />
            <CommandList className="h-[min(240px,36dvh)] max-h-[240px] overflow-y-auto">
              <CommandEmpty>No partner groups found.</CommandEmpty>
              <CommandGroup>
                {groups.map(group => {
                  const isSelected = selected.includes(group.id)
                  return (
                    <CommandItem
                      key={group.id}
                      value={`${group.name} ${group.slug}`}
                      onSelect={() => toggleGroup(group.id)}
                      className="text-ssm"
                    >
                      <span className={cn(
                        'flex size-4 items-center justify-center rounded border border-border',
                        isSelected && 'border-primary bg-primary text-white',
                      )}>
                        {isSelected && <Check size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{group.name}</div>
                        <div className="truncate text-xxs text-slate-400">
                          {group.members.length} member{group.members.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xxs text-slate-400">
        Partners only see this deal when they belong to one of these groups.
      </p>
    </div>
  )
}
