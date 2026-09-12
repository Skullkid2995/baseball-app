import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  NotebookPen,
  PenTool,
  Scale,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import type { Translations } from '@/lib/translations'

export interface NavItem {
  href: string
  /** Key into the translations object for the label. */
  labelKey: keyof Translations
  /** Permission key from lib/permissions.ts; hidden unless the role can view it */
  feature: string
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
      { href: '/dashboard', labelKey: 'dashboard', feature: 'dashboard', Icon: LayoutDashboard },
      { href: '/teams', labelKey: 'teams', feature: 'teams', Icon: Users },
      { href: '/players', labelKey: 'players', feature: 'players', Icon: UserRound },
      { href: '/games', labelKey: 'games', feature: 'games', Icon: CalendarDays },
    ],
  },
  {
    labelKey: 'navAnalysis',
    items: [
      { href: '/statistics', labelKey: 'statistics', feature: 'statistics', Icon: BarChart3 },
      { href: '/lineups', labelKey: 'lineups', feature: 'lineups', Icon: ClipboardList },
      { href: '/rules', labelKey: 'rules', feature: 'rules', Icon: Scale },
    ],
  },
  {
    labelKey: 'navSystem',
    items: [
      { href: '/handwriting', labelKey: 'handwritingLab', feature: 'handwritingLab', Icon: PenTool },
      { href: '/scorecard-lab', labelKey: 'scorecardLab', feature: 'scorecardLab', Icon: NotebookPen },
      { href: '/settings', labelKey: 'settings', feature: 'settings', Icon: Settings },
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
