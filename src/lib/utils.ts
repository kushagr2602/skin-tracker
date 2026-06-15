import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function severityColor(severity: number): string {
  if (severity <= 2) return 'text-green-600'
  if (severity <= 4) return 'text-lime-600'
  if (severity <= 6) return 'text-yellow-600'
  if (severity <= 8) return 'text-orange-600'
  return 'text-red-600'
}

export function severityBg(severity: number): string {
  if (severity <= 2) return 'bg-green-100 border-green-300'
  if (severity <= 4) return 'bg-lime-100 border-lime-300'
  if (severity <= 6) return 'bg-yellow-100 border-yellow-300'
  if (severity <= 8) return 'bg-orange-100 border-orange-300'
  return 'bg-red-100 border-red-300'
}

export function severityLabel(severity: number): string {
  if (severity <= 2) return 'Clear'
  if (severity <= 4) return 'Mild'
  if (severity <= 6) return 'Moderate'
  if (severity <= 8) return 'Severe'
  return 'Very Severe'
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
