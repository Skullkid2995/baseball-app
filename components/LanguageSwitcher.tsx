'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { Language } from '@/lib/translations'
import { cn } from '@/lib/utils'

const OPTIONS: Language[] = ['en', 'es']

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div
      className="inline-flex items-center rounded-lg bg-secondary p-0.5"
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
            language === lang
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
