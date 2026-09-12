'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Database, ExternalLink, Languages, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { supabase } from '@/lib/supabase'
import { env } from '@/lib/env'
import { ALLOWED_EMAILS } from '@/lib/auth'
import { useLanguage } from '@/contexts/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@/components/ui'

interface OurTeam {
  id: string
  name: string
  city: string
  logo_url: string | null
  manager: string | null
  players: { id: string }[]
}

const VERCEL_URL = 'https://baseball-app-swart.vercel.app'

export default function SettingsView() {
  const { language, t } = useLanguage()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [team, setTeam] = useState<OurTeam | null>(null)

  const L =
    language === 'es'
      ? {
          title: 'Configuración',
          description: 'Preferencias, cuenta y datos del sistema.',
          preferences: 'Preferencias',
          preferencesHint: 'El idioma se guarda en este navegador.',
          languageLabel: 'Idioma de la aplicación',
          ourTeam: 'Nuestro equipo',
          ourTeamHint: 'El equipo cuyas estadísticas se registran en cada juego.',
          players: 'jugadores',
          manage: 'Administrar en Equipos',
          account: 'Cuenta',
          accountHint: 'Sesión iniciada con Google.',
          signOut: 'Cerrar sesión',
          access: 'Acceso',
          accessHint: 'Solo estas cuentas de Google pueden entrar. Se cambian en el código (lib/auth.ts).',
          you: 'tú',
          system: 'Sistema',
          systemHint: 'Referencias técnicas del proyecto.',
          project: 'Proyecto Supabase',
          production: 'Sitio en producción',
          dashboard: 'Abrir panel de Supabase',
        }
      : {
          title: 'Settings',
          description: 'Preferences, account and system details.',
          preferences: 'Preferences',
          preferencesHint: 'Language is remembered in this browser.',
          languageLabel: 'App language',
          ourTeam: 'Our team',
          ourTeamHint: 'The team whose stats are tracked in every game.',
          players: 'players',
          manage: 'Manage under Teams',
          account: 'Account',
          accountHint: 'Signed in with Google.',
          signOut: 'Sign out',
          access: 'Access',
          accessHint: 'Only these Google accounts can sign in. They are changed in code (lib/auth.ts).',
          you: 'you',
          system: 'System',
          systemHint: 'Technical references for the project.',
          project: 'Supabase project',
          production: 'Production site',
          dashboard: 'Open Supabase dashboard',
        }

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data }) => setUser(data.user ?? null))

    async function loadTeam() {
      // Our team = the one referenced by games, falling back to the biggest non-opponent roster
      const { data: game } = await supabase
        .from('games')
        .select('team_id')
        .not('team_id', 'is', null)
        .limit(1)
        .maybeSingle()
      let query = supabase.from('teams').select('id, name, city, logo_url, manager, players ( id )')
      if (game?.team_id) {
        query = query.eq('id', game.team_id)
      } else {
        query = query.neq('city', 'Opponent')
      }
      const { data } = await query
      const rows = (data || []) as OurTeam[]
      rows.sort((a, b) => (b.players?.length || 0) - (a.players?.length || 0))
      setTeam(rows[0] ?? null)
    }
    loadTeam()
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const projectRef = (() => {
    try {
      return new URL(env.supabase.url).hostname.split('.')[0]
    } catch {
      return env.supabase.url
    }
  })()

  return (
    <div className="space-y-6">
      <PageHeader title={L.title} description={L.description} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Preferences */}
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Languages className="size-4" />
            </span>
            <div>
              <CardTitle>{L.preferences}</CardTitle>
              <CardDescription>{L.preferencesHint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4 pt-2">
            <span className="text-sm font-medium text-slate-700">{L.languageLabel}</span>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        {/* Our team */}
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Users className="size-4" />
            </span>
            <div>
              <CardTitle>{L.ourTeam}</CardTitle>
              <CardDescription>{L.ourTeamHint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {team ? (
              <div className="flex items-center gap-4">
                <Avatar
                  src={team.logo_url}
                  alt={team.name}
                  initials={team.name.charAt(0)}
                  size="xl"
                  rounded="lg"
                  className="object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">{team.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {team.city}
                    {team.manager ? ` · ${team.manager}` : ''} · {team.players?.length || 0} {L.players}
                  </div>
                  <Link href="/teams" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">
                    {L.manage}
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <CardTitle>{L.account}</CardTitle>
              <CardDescription>{L.accountHint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-secondary-foreground">
                {user?.email ? user.email.slice(0, 2).toUpperCase() : '–'}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user?.email ?? '…'}</div>
                <div className="text-xs text-muted-foreground">Google</div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.access}</p>
              <ul className="space-y-1.5">
                {ALLOWED_EMAILS.map((email) => (
                  <li key={email} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{email}</span>
                    {user?.email === email && <Badge variant="primary">{L.you}</Badge>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{L.accessHint}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut />
              {L.signOut || t.logout}
            </Button>
          </CardContent>
        </Card>

        {/* System */}
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Database className="size-4" />
            </span>
            <div>
              <CardTitle>{L.system}</CardTitle>
              <CardDescription>{L.systemHint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{L.project}</dt>
              <dd className="truncate font-mono text-xs leading-5">{projectRef}</dd>
              <dt className="text-muted-foreground">{L.production}</dt>
              <dd>
                <a
                  href={VERCEL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {VERCEL_URL.replace('https://', '')}
                  <ExternalLink className="size-3.5" />
                </a>
              </dd>
            </dl>
            <a
              href={`https://supabase.com/dashboard/project/${projectRef}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {L.dashboard}
              <ExternalLink className="size-3.5" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
