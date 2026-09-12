import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  PenTool,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import type { Translations } from '@/lib/translations'

export interface NavItem {
  href: string
  /** Key into the translations object for the label. */
  labelKey: keyof Translations
  Icon: LucideIcon
  /** Placeholder view that is on the roadmap but not built yet. */
  soon?: boolean
}

export interface NavGroup {
  labelKey: keyof Translations
  items: NavItem[]
}

/**
 * Single source of truth for the app's sections. Add a new view here and it
 * appears in the sidebar, the mobile drawer, and the header title.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'navMain',
    items: [
      { href: '/dashboard', labelKey: 'dashboard', Icon: LayoutDashboard },
      { href: '/teams', labelKey: 'teams', Icon: Users },
      { href: '/players', labelKey: 'players', Icon: UserRound },
      { href: '/games', labelKey: 'games', Icon: CalendarDays },
    ],
  },
  {
    labelKey: 'navAnalysis',
    items: [
      { href: '/statistics', labelKey: 'statistics', Icon: BarChart3 },
      { href: '/lineups', labelKey: 'lineups', Icon: ClipboardList },
    ],
  },
  {
    labelKey: 'navSystem',
    items: [
      { href: '/handwriting', labelKey: 'handwritingLab', Icon: PenTool },
      { href: '/settings', labelKey: 'settings', Icon: Settings },
    ],
  },
]

export function findNavItem(pathname: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item
    }
  }
  return undefined
}
