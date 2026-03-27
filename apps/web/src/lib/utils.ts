export function formatPeso(n: number): string {
  return 'P' + new Intl.NumberFormat('en-PH').format(n)
}

export function formatPesoShort(n: number): string {
  if (n >= 1_000_000) return 'P' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'P' + Math.round(n / 1_000) + 'K'
  return formatPeso(n)
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}
