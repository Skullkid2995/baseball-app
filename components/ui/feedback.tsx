import * as React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-primary', className)} aria-hidden="true" />
}

export function LoadingState({ label, className }: { label?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground', className)}>
      <Spinner />
      {label && <span>{label}</span>}
    </div>
  )
}

const alertStyles = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertTriangle },
  info: { box: 'border-blue-200 bg-blue-50 text-blue-800', Icon: Info },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
} as const

export function Alert({
  variant = 'info',
  title,
  className,
  children,
}: {
  variant?: keyof typeof alertStyles
  title?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const { box, Icon } = alertStyles[variant]
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', box, className)} role="alert">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-card px-6 py-14 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Section title row used at the top of each page: title, count pill, and actions on the right. */
export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  count?: number
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
          {typeof count === 'number' && (
            <span className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-bold text-secondary-foreground tabular-nums">
              {count}
            </span>
          )}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Circular avatar with image fallback to initials. */
export function Avatar({
  src,
  alt,
  initials,
  size = 'md',
  className,
  rounded = 'full',
}: {
  src?: string | null
  alt: string
  initials: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'full' | 'lg'
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  const dims = { sm: 'size-8 text-[10px]', md: 'size-10 text-xs', lg: 'size-14 text-sm', xl: 'size-20 text-base' }[size]
  const shape = rounded === 'full' ? 'rounded-full' : 'rounded-lg'
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('shrink-0 border border-border bg-card object-cover', dims, shape, className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-slate-200 font-semibold uppercase text-slate-600',
        dims,
        shape,
        className
      )}
      aria-label={alt}
    >
      {initials}
    </div>
  )
}
