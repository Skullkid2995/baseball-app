'use client'

import { Monitor, Smartphone, Sparkles } from 'lucide-react'
import { useViewMode, type ViewMode } from '@/contexts/ViewModeContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { cn } from '@/lib/utils'

/** Segmented control: Auto / Mobile / Desktop layout. */
export default function ViewModeSwitcher({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { mode, setMode } = useViewMode()
  const { language } = useLanguage()

  const L =
    language === 'es'
      ? { title: 'Vista', auto: 'Auto', mobile: 'Móvil', desktop: 'Escritorio' }
      : { title: 'View', auto: 'Auto', mobile: 'Mobile', desktop: 'Desktop' }

  const options: { value: ViewMode; label: string; Icon: typeof Monitor }[] = [
    { value: 'auto', label: L.auto, Icon: Sparkles },
    { value: 'mobile', label: L.mobile, Icon: Smartphone },
    { value: 'desktop', label: L.desktop, Icon: Monitor },
  ]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && <span className="text-sm font-medium text-slate-700">{L.title}</span>}
      <div className="inline-flex w-full items-center rounded-lg bg-secondary p-0.5" role="group" aria-label={L.title}>
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            title={label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              mode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
