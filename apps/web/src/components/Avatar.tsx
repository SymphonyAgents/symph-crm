'use client'

import { Facehash } from 'facehash'
import { cn } from '@/lib/utils'

type AvatarProps = {
  name: string
  size?: number
  className?: string
}

export function Avatar({ name, size = 26, className }: AvatarProps) {
  return (
    <div className={cn('rounded-full overflow-hidden shrink-0', className)} style={{ width: size, height: size }}>
      <Facehash name={name || 'unknown'} size={size} variant="gradient" />
    </div>
  )
}
