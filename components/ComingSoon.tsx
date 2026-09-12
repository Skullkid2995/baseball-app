'use client'

import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { useLanguage } from '@/contexts/LanguageContext'
import type { Translations } from '@/lib/translations'

/** Placeholder body for views that are on the roadmap but not built yet. */
export default function ComingSoon({ titleKey }: { titleKey: keyof Translations }) {
  const { t } = useLanguage()
  return (
    <EmptyState
      icon={<Construction />}
      title={`${t[titleKey]} · ${t.comingSoon}`}
      description={t.comingSoonDescription}
      className="py-24"
    />
  )
}
