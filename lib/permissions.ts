/**
 * Roles and per-feature permissions.
 *
 * FEATURES is the registry of everything the app has; add a new section here
 * (and in lib/navigation.ts) and it starts DISABLED for every role until a
 * super admin enables it in Settings. Super admins can always do everything.
 *
 * Permission rows live in the role_permissions table (role, feature, can_view,
 * can_edit); users in app_users. Both come from database/migrations/2026-09-12_users_roles.sql.
 */
import { ALLOWED_EMAILS } from '@/lib/auth'

export type Role = 'super_admin' | 'coach' | 'board' | 'player'
export type ConfigurableRole = Exclude<Role, 'super_admin'>
export type Lang = 'es' | 'en'

export const ROLE_ORDER: Role[] = ['super_admin', 'coach', 'board', 'player']
export const CONFIGURABLE_ROLES: ConfigurableRole[] = ['coach', 'board', 'player']

export const ROLE_LABELS: Record<Role, Record<Lang, string>> = {
  super_admin: { es: 'Super admin', en: 'Super admin' },
  coach: { es: 'Coach / Manager', en: 'Coach / Manager' },
  board: { es: 'Presidente / VP / Tesorero', en: 'President / VP / Treasurer' },
  player: { es: 'Jugador', en: 'Player' },
}

export type FeatureGroup = 'main' | 'analysis' | 'system' | 'actions'

export interface FeatureDef {
  /** Stable key stored in role_permissions.feature */
  key: string
  /** Route the feature lives at (page features); actions have none */
  href?: string
  label: Record<Lang, string>
  hint: Record<Lang, string>
  group: FeatureGroup
}

export const FEATURES: FeatureDef[] = [
  { key: 'dashboard', href: '/dashboard', group: 'main', label: { es: 'Panel', en: 'Dashboard' }, hint: { es: 'Resumen del equipo y próximos juegos', en: 'Team summary and upcoming games' } },
  { key: 'teams', href: '/teams', group: 'main', label: { es: 'Equipos', en: 'Teams' }, hint: { es: 'Equipos, plantillas y fotos. Editar = alta y cambios de jugadores', en: 'Teams, rosters and photos. Edit = add and change players' } },
  { key: 'players', href: '/players', group: 'main', label: { es: 'Jugadores', en: 'Players' }, hint: { es: 'Directorio de jugadores', en: 'Player directory' } },
  { key: 'games', href: '/games', group: 'main', label: { es: 'Juegos', en: 'Games' }, hint: { es: 'Calendario y resultados. Editar = crear juegos y preparar alineaciones', en: 'Schedule and results. Edit = create games and prepare lineups' } },
  { key: 'live', href: '/live', group: 'main', label: { es: 'Juego actual', en: 'Current game' }, hint: { es: 'El juego en curso de tu equipo, listo para anotar (menú rápido)', en: "Your team's game in progress, ready to score (quick menu)" } },
  { key: 'schedule', href: '/schedule', group: 'main', label: { es: 'Calendario', en: 'Schedule' }, hint: { es: 'Calendario de juegos según tu equipo o tu liga (menú rápido)', en: 'Calendar of games for your team or league (quick menu)' } },
  { key: 'leagues', href: '/leagues', group: 'main', label: { es: 'Ligas', en: 'Leagues' }, hint: { es: 'Ligas, estadios, equipos y directiva. Editar = crear y cambiar', en: 'Leagues, stadiums, teams and officers. Edit = create and change' } },
  { key: 'scorebook', group: 'actions', label: { es: 'Anotar juegos', en: 'Score games' }, hint: { es: 'Abrir el scorebook en vivo. Editar = anotar turnos', en: 'Open the live scorebook. Edit = score at-bats' } },
  { key: 'statistics', href: '/statistics', group: 'analysis', label: { es: 'Estadísticas', en: 'Statistics' }, hint: { es: 'Números del equipo y de cada jugador', en: 'Team and player numbers' } },
  { key: 'lineups', href: '/lineups', group: 'analysis', label: { es: 'Alineaciones', en: 'Lineups' }, hint: { es: 'Plantillas de alineación. Editar = crear y cambiar', en: 'Lineup templates. Edit = create and change' } },
  { key: 'rules', href: '/rules', group: 'analysis', label: { es: 'Reglas', en: 'Rules' }, hint: { es: 'Reglas del juego y simulador. Editar = guardar cambios', en: 'Game rules and simulator. Edit = save changes' } },
  { key: 'handwritingLab', href: '/handwriting', group: 'system', label: { es: 'Laboratorio de escritura', en: 'Handwriting lab' }, hint: { es: 'Muestras para reconocer letras y jugadas', en: 'Samples to recognize letters and plays' } },
  { key: 'scorecardLab', href: '/scorecard-lab', group: 'system', label: { es: 'Laboratorio de scorecard', en: 'Scorecard lab' }, hint: { es: 'Escenarios para afinar la casilla clásica', en: 'Scenarios to tune the classic box' } },
  { key: 'settings', href: '/settings', group: 'system', label: { es: 'Configuración', en: 'Settings' }, hint: { es: 'Preferencias propias. Usuarios y permisos son solo de super admin', en: 'Own preferences. Users and permissions are super admin only' } },
]

export const FEATURE_KEYS = FEATURES.map((f) => f.key)

export function featureForPath(pathname: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.href && (pathname === f.href || pathname.startsWith(f.href + '/')))
}

export interface Permission {
  view: boolean
  edit: boolean
}
/** role -> feature -> permission. Missing entries mean no access. */
export type PermissionMap = Partial<Record<ConfigurableRole, Record<string, Permission>>>

export interface AppUser {
  id: string
  email: string
  display_name: string | null
  role: Role
  player_id: string | null
  active: boolean
  team_id?: string | null
  league_id?: string | null
  created_at?: string
}

/** Owner accounts: super admins no matter what the database says (never locked out). */
export const BOOTSTRAP_SUPER_ADMINS: readonly string[] = ALLOWED_EMAILS

export function isBootstrapAdmin(email: string | null | undefined): boolean {
  return !!email && BOOTSTRAP_SUPER_ADMINS.includes(email.toLowerCase())
}

export function can(role: Role | null, perms: PermissionMap, feature: string, action: 'view' | 'edit'): boolean {
  if (role === 'super_admin') return true
  if (!role) return false
  const p = perms[role]?.[feature]
  if (!p) return false
  return action === 'view' ? p.view || p.edit : p.edit
}

export function roleLabel(role: Role | null, lang: Lang): string {
  return role ? ROLE_LABELS[role][lang] : '—'
}
