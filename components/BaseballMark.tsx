import { cn } from '@/lib/utils'

/** Small baseball glyph used as the app logo mark. */
export default function BaseballMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-5', className)} aria-hidden="true" fill="none">
      <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.15" />
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 5.5c3.5 3 5.5 6.5 5.5 10.5S10.5 23.5 7 26.5M25 5.5c-3.5 3-5.5 6.5-5.5 10.5s2 7.5 5.5 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 9.5l2 .5M9 13l2.5-.2M9 19l2.5.2M9.5 22.5l2-.5M22.5 9.5l-2 .5M23 13l-2.5-.2M23 19l-2.5.2M22.5 22.5l-2-.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
