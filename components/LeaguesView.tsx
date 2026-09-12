'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, Pencil, Plus, Trash2, Trophy, UserCog, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { ROLE_LABELS, type AppUser } from '@/lib/permissions'
import { Alert, Badge, Button, Card, CardContent, EmptyState, FormField, Input, LoadingState, Modal, PageHeader, Select, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface League {
  id: string
  name: string
  city: string | null
  state: string | null
  country: string | null
  address: string | null
  notes: string | null
}
export interface Stadium {
  id: string
  league_id: string
  name: string
  city: string | null
  state: string | null
  country: string | null
  address: string | null
  notes: string | null
}
interface TeamRow {
  id: string
  name: string
  city: string
  league_id: string | null
}
interface Officer {
  id: string
  league_id: string
  app_user_id: string
  office: string
  title: string | null
  app_users?: { email: string; display_name: string | null; role: string } | null
}

const OFFICES = ['president', 'vice_president', 'treasurer', 'secretary', 'commissioner', 'other'] as const
type Office = (typeof OFFICES)[number]

const TEXT = {
  es: {
    title: 'Ligas',
    description: 'Cada liga con su ubicación, sus estadios, sus equipos y su directiva.',
    newLeague: 'Nueva liga',
    editLeague: 'Editar liga',
    name: 'Nombre',
    city: 'Ciudad',
    state: 'Estado / Provincia',
    country: 'País',
    address: 'Dirección',
    notes: 'Notas',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    confirmDeleteLeague: '¿Eliminar esta liga? Sus estadios y directiva se borran; los equipos quedan sin liga.',
    confirmDeleteStadium: '¿Eliminar este estadio?',
    empty: 'Todavía no hay ligas',
    emptyHint: 'Crea la primera liga y agrega sus estadios y equipos.',
    tabs: { info: 'Datos', stadiums: 'Estadios', teams: 'Equipos', officers: 'Directiva' },
    stadiums: 'Estadios',
    newStadium: 'Nuevo estadio',
    editStadium: 'Editar estadio',
    noStadiums: 'Sin estadios. Los juegos de esta liga se juegan en alguno de ellos.',
    teams: 'Equipos',
    teamsHint: 'Marca los equipos que juegan en esta liga.',
    inOtherLeague: 'en otra liga',
    officers: 'Directiva',
    officersHint: 'Personas con cargo en la liga. Deben existir primero como usuarios (Configuración → Usuarios).',
    addOfficer: 'Agregar cargo',
    user: 'Usuario',
    office: 'Cargo',
    titleLabel: 'Título (opcional)',
    noOfficers: 'Sin directiva registrada.',
    offices: { president: 'Presidente', vice_president: 'Vicepresidente', treasurer: 'Tesorero', secretary: 'Secretario', commissioner: 'Comisionado', other: 'Otro' },
    readOnly: 'Solo lectura: pide a un super admin o a la directiva de la liga que haga cambios.',
    counts: (s: number, t: number) => `${s} estadios · ${t} equipos`,
    loading: 'Cargando ligas…',
    requiredName: 'El nombre es obligatorio.',
  },
  en: {
    title: 'Leagues',
    description: 'Each league with its location, stadiums, teams, and officers.',
    newLeague: 'New league',
    editLeague: 'Edit league',
    name: 'Name',
    city: 'City',
    state: 'State / Province',
    country: 'Country',
    address: 'Address',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirmDeleteLeague: 'Delete this league? Its stadiums and officers are removed; teams are left without a league.',
    confirmDeleteStadium: 'Delete this stadium?',
    empty: 'No leagues yet',
    emptyHint: 'Create the first league and add its stadiums and teams.',
    tabs: { info: 'Details', stadiums: 'Stadiums', teams: 'Teams', officers: 'Officers' },
    stadiums: 'Stadiums',
    newStadium: 'New stadium',
    editStadium: 'Edit stadium',
    noStadiums: 'No stadiums yet. Games in this league are played at one of them.',
    teams: 'Teams',
    teamsHint: 'Check the teams that play in this league.',
    inOtherLeague: 'in another league',
    officers: 'Officers',
    officersHint: 'People with a role in the league. They must exist as users first (Settings → Users).',
    addOfficer: 'Add role',
    user: 'User',
    office: 'Office',
    titleLabel: 'Title (optional)',
    noOfficers: 'No officers yet.',
    offices: { president: 'President', vice_president: 'Vice president', treasurer: 'Treasurer', secretary: 'Secretary', commissioner: 'Commissioner', other: 'Other' },
    readOnly: 'Read only: ask a super admin or the league officers to make changes.',
    counts: (s: number, t: number) => `${s} stadiums · ${t} teams`,
    loading: 'Loading leagues…',
    requiredName: 'The name is required.',
  },
}

type Tab = 'info' | 'stadiums' | 'teams' | 'officers'
const EMPTY_LEAGUE = { name: '', city: '', state: '', country: 'México', address: '', notes: '' }
const EMPTY_STADIUM = { name: '', city: '', state: '', country: '', address: '', notes: '' }

type LocationValue = typeof EMPTY_LEAGUE
/** Name + location fields shared by the league and stadium forms. Top-level so typing never remounts the inputs. */
function LocationFields({ v, set, L }: { v: LocationValue; set: (n: LocationValue) => void; L: (typeof TEXT)['es'] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={L.name} required className="sm:col-span-2">
        <Input value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} autoFocus />
      </FormField>
      <FormField label={L.city}>
        <Input value={v.city} onChange={(e) => set({ ...v, city: e.target.value })} />
      </FormField>
      <FormField label={L.state}>
        <Input value={v.state} onChange={(e) => set({ ...v, state: e.target.value })} />
      </FormField>
      <FormField label={L.country}>
        <Input value={v.country} onChange={(e) => set({ ...v, country: e.target.value })} />
      </FormField>
      <FormField label={L.address}>
        <Input value={v.address} onChange={(e) => set({ ...v, address: e.target.value })} />
      </FormField>
      <FormField label={L.notes} className="sm:col-span-2">
        <Textarea value={v.notes} onChange={(e) => set({ ...v, notes: e.target.value })} />
      </FormField>
    </div>
  )
}

export default function LeaguesView() {
  const { language } = useLanguage()
  const lang = language === 'es' ? 'es' : 'en'
  const L = TEXT[lang]
  const { canEdit, isSuperAdmin, role, leagueId: myLeagueId } = usePermissions()

  const [leagues, setLeagues] = useState<League[]>([])
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [officers, setOfficers] = useState<Officer[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('info')

  const [leagueForm, setLeagueForm] = useState<(typeof EMPTY_LEAGUE & { id?: string }) | null>(null)
  const [stadiumForm, setStadiumForm] = useState<(typeof EMPTY_STADIUM & { id?: string }) | null>(null)
  const [officerForm, setOfficerForm] = useState<{ app_user_id: string; office: Office; title: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [l, s, t, o, u] = await Promise.all([
      supabase.from('leagues').select('*').order('name'),
      supabase.from('stadiums').select('*').order('name'),
      supabase.from('teams').select('id, name, city, league_id').order('name'),
      supabase.from('league_officers').select('id, league_id, app_user_id, office, title, app_users ( email, display_name, role )').order('created_at'),
      supabase.from('app_users').select('id, email, display_name, role, player_id, active').order('display_name'),
    ])
    const err = l.error || s.error || t.error || o.error || u.error
    if (err) setError(err.message)
    setLeagues((l.data as League[]) ?? [])
    setStadiums((s.data as Stadium[]) ?? [])
    setTeams((t.data as TeamRow[]) ?? [])
    setOfficers(((o.data ?? []) as unknown as Officer[]) ?? [])
    setUsers((u.data as AppUser[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected && leagues.length > 0) setSelected(myLeagueId && leagues.some((l) => l.id === myLeagueId) ? myLeagueId : leagues[0].id)
  }, [leagues, selected, myLeagueId])

  const league = useMemo(() => leagues.find((l) => l.id === selected) ?? null, [leagues, selected])
  const leagueStadiums = useMemo(() => stadiums.filter((s) => s.league_id === selected), [stadiums, selected])
  const leagueTeams = useMemo(() => teams.filter((t) => t.league_id === selected), [teams, selected])
  const leagueOfficers = useMemo(() => officers.filter((o) => o.league_id === selected), [officers, selected])
  // Super admins edit everything; a president/VP/treasurer edits their own league
  const canManage = (id: string | null) => canEdit('leagues') && (isSuperAdmin || (role === 'board' && !!id && id === myLeagueId))
  const canCreate = canEdit('leagues') && isSuperAdmin

  const place = (x: { city: string | null; state: string | null; country: string | null }) => [x.city, x.state, x.country].filter(Boolean).join(', ')

  // ---- league create / edit ----
  const saveLeague = async () => {
    if (!leagueForm) return
    if (!leagueForm.name.trim()) {
      setError(L.requiredName)
      return
    }
    setSaving(true)
    setError(null)
    const row = {
      name: leagueForm.name.trim(),
      city: leagueForm.city.trim() || null,
      state: leagueForm.state.trim() || null,
      country: leagueForm.country.trim() || null,
      address: leagueForm.address.trim() || null,
      notes: leagueForm.notes.trim() || null,
    }
    const res = leagueForm.id
      ? await supabase.from('leagues').update(row).eq('id', leagueForm.id)
      : await supabase.from('leagues').insert([row]).select('id').single()
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    if (!leagueForm.id && res.data && 'id' in res.data) setSelected((res.data as { id: string }).id)
    setLeagueForm(null)
    await load()
  }
  const deleteLeague = async (id: string) => {
    if (!confirm(L.confirmDeleteLeague)) return
    const { error: err } = await supabase.from('leagues').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setSelected(null)
    await load()
  }

  // ---- stadiums ----
  const saveStadium = async () => {
    if (!stadiumForm || !selected) return
    if (!stadiumForm.name.trim()) {
      setError(L.requiredName)
      return
    }
    setSaving(true)
    setError(null)
    const row = {
      league_id: selected,
      name: stadiumForm.name.trim(),
      city: stadiumForm.city.trim() || null,
      state: stadiumForm.state.trim() || null,
      country: stadiumForm.country.trim() || null,
      address: stadiumForm.address.trim() || null,
      notes: stadiumForm.notes.trim() || null,
    }
    const res = stadiumForm.id ? await supabase.from('stadiums').update(row).eq('id', stadiumForm.id) : await supabase.from('stadiums').insert([row])
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setStadiumForm(null)
    await load()
  }
  const deleteStadium = async (id: string) => {
    if (!confirm(L.confirmDeleteStadium)) return
    const { error: err } = await supabase.from('stadiums').delete().eq('id', id)
    if (err) setError(err.message)
    await load()
  }

  // ---- teams ----
  const toggleTeam = async (t: TeamRow) => {
    if (!selected) return
    const next = t.league_id === selected ? null : selected
    setTeams((prev) => prev.map((x) => (x.id === t.id ? { ...x, league_id: next } : x)))
    const { error: err } = await supabase.from('teams').update({ league_id: next }).eq('id', t.id)
    if (err) {
      setError(err.message)
      await load()
    }
  }

  // ---- officers ----
  const saveOfficer = async () => {
    if (!officerForm || !selected || !officerForm.app_user_id) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('league_officers')
      .insert([{ league_id: selected, app_user_id: officerForm.app_user_id, office: officerForm.office, title: officerForm.title.trim() || null }])
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    // a president / VP / treasurer runs this league: point their user at it
    await supabase.from('app_users').update({ league_id: selected }).eq('id', officerForm.app_user_id)
    setOfficerForm(null)
    await load()
  }
  const removeOfficer = async (id: string) => {
    const { error: err } = await supabase.from('league_officers').delete().eq('id', id)
    if (err) setError(err.message)
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={L.title} description={L.description} />
        <LoadingState label={L.loading} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={L.title}
        description={L.description}
        count={leagues.length}
        actions={
          canCreate && (
            <Button onClick={() => setLeagueForm({ ...EMPTY_LEAGUE })}>
              <Plus /> {L.newLeague}
            </Button>
          )
        }
      />
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {leagues.length === 0 ? (
        <EmptyState icon={<Trophy />} title={L.empty} description={L.emptyHint} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* League list */}
          <ul className="space-y-2">
            {leagues.map((l) => {
              const active = l.id === selected
              const sc = stadiums.filter((s) => s.league_id === l.id).length
              const tc = teams.filter((t) => t.league_id === l.id).length
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(l.id)
                      setTab('info')
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      active ? 'border-primary bg-accent shadow-sm' : 'border-border bg-card hover:bg-slate-50'
                    )}
                  >
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500')}>
                      <Trophy className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{place(l) || '—'}</span>
                      <span className="block text-xs text-muted-foreground">{L.counts(sc, tc)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* League detail */}
          {league && (
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{league.name}</h3>
                    <p className="text-sm text-muted-foreground">{place(league) || '—'}</p>
                  </div>
                  {canManage(league.id) && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setLeagueForm({ id: league.id, name: league.name, city: league.city ?? '', state: league.state ?? '', country: league.country ?? '', address: league.address ?? '', notes: league.notes ?? '' })}>
                        <Pencil /> {L.editLeague}
                      </Button>
                      {isSuperAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => deleteLeague(league.id)} aria-label={L.delete}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {!canManage(league.id) && <p className="text-xs text-muted-foreground">{L.readOnly}</p>}

                <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-0.5">
                  {(['info', 'stadiums', 'teams', 'officers'] as Tab[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', tab === k ? 'bg-card shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                    >
                      {L.tabs[k]}
                    </button>
                  ))}
                </div>

                {tab === 'info' && (
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <dt className="text-muted-foreground">{L.city}</dt>
                    <dd>{league.city || '—'}</dd>
                    <dt className="text-muted-foreground">{L.state}</dt>
                    <dd>{league.state || '—'}</dd>
                    <dt className="text-muted-foreground">{L.country}</dt>
                    <dd>{league.country || '—'}</dd>
                    <dt className="text-muted-foreground">{L.address}</dt>
                    <dd>{league.address || '—'}</dd>
                    {league.notes && (
                      <>
                        <dt className="text-muted-foreground">{L.notes}</dt>
                        <dd className="whitespace-pre-wrap">{league.notes}</dd>
                      </>
                    )}
                  </dl>
                )}

                {tab === 'stadiums' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <Building2 className="size-4 text-slate-500" /> {L.stadiums}
                      </h4>
                      {canManage(league.id) && (
                        <Button size="sm" onClick={() => setStadiumForm({ ...EMPTY_STADIUM, city: league.city ?? '', state: league.state ?? '', country: league.country ?? '' })}>
                          <Plus /> {L.newStadium}
                        </Button>
                      )}
                    </div>
                    {leagueStadiums.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{L.noStadiums}</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {leagueStadiums.map((s) => (
                          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                            <MapPin className="size-4 shrink-0 text-slate-400" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{s.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{[s.address, place(s)].filter(Boolean).join(' · ') || '—'}</div>
                            </div>
                            {canManage(league.id) && (
                              <>
                                <Button size="icon-sm" variant="ghost" onClick={() => setStadiumForm({ id: s.id, name: s.name, city: s.city ?? '', state: s.state ?? '', country: s.country ?? '', address: s.address ?? '', notes: s.notes ?? '' })} aria-label={L.editStadium}>
                                  <Pencil />
                                </Button>
                                <Button size="icon-sm" variant="ghost" onClick={() => deleteStadium(s.id)} aria-label={L.delete}>
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {tab === 'teams' && (
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="size-4 text-slate-500" /> {L.teams}
                    </h4>
                    <p className="text-xs text-muted-foreground">{L.teamsHint}</p>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {teams.map((t) => {
                        const inThis = t.league_id === selected
                        const other = t.league_id && !inThis ? leagues.find((l) => l.id === t.league_id) : null
                        return (
                          <li key={t.id}>
                            <label className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5', !canManage(league.id) && 'cursor-default')}>
                              <input type="checkbox" className="size-4 accent-primary" checked={inThis} disabled={!canManage(league.id)} onChange={() => toggleTeam(t)} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{t.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {t.city}
                                  {other ? ` · ${L.inOtherLeague}: ${other.name}` : ''}
                                </span>
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {tab === 'officers' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <UserCog className="size-4 text-slate-500" /> {L.officers}
                      </h4>
                      {canManage(league.id) && (
                        <Button size="sm" onClick={() => setOfficerForm({ app_user_id: '', office: 'president', title: '' })}>
                          <Plus /> {L.addOfficer}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{L.officersHint}</p>
                    {leagueOfficers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{L.noOfficers}</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {leagueOfficers.map((o) => (
                          <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{o.app_users?.display_name || o.app_users?.email || '—'}</div>
                              <div className="truncate text-xs text-muted-foreground">{o.app_users?.email}</div>
                            </div>
                            <Badge variant="primary">{o.title || L.offices[o.office as Office] || o.office}</Badge>
                            {canManage(league.id) && (
                              <Button size="icon-sm" variant="ghost" onClick={() => removeOfficer(o.id)} aria-label={L.delete}>
                                <Trash2 />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {leagueForm && (
        <Modal
          onClose={() => setLeagueForm(null)}
          title={leagueForm.id ? L.editLeague : L.newLeague}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLeagueForm(null)}>
                {L.cancel}
              </Button>
              <Button onClick={saveLeague} loading={saving}>
                {L.save}
              </Button>
            </div>
          }
        >
          <LocationFields L={L} v={leagueForm} set={(n) => setLeagueForm({ ...leagueForm, ...n })} />
        </Modal>
      )}

      {stadiumForm && (
        <Modal
          onClose={() => setStadiumForm(null)}
          title={stadiumForm.id ? L.editStadium : L.newStadium}
          description={league?.name}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStadiumForm(null)}>
                {L.cancel}
              </Button>
              <Button onClick={saveStadium} loading={saving}>
                {L.save}
              </Button>
            </div>
          }
        >
          <LocationFields L={L} v={stadiumForm} set={(n) => setStadiumForm({ ...stadiumForm, ...n })} />
        </Modal>
      )}

      {officerForm && (
        <Modal
          onClose={() => setOfficerForm(null)}
          title={L.addOfficer}
          description={league?.name}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOfficerForm(null)}>
                {L.cancel}
              </Button>
              <Button onClick={saveOfficer} loading={saving} disabled={!officerForm.app_user_id}>
                {L.save}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={L.user} required>
              <Select value={officerForm.app_user_id} onChange={(e) => setOfficerForm({ ...officerForm, app_user_id: e.target.value })}>
                <option value="">—</option>
                {users
                  .filter((u) => u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.email} · {ROLE_LABELS[u.role][lang]}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label={L.office} required>
              <Select value={officerForm.office} onChange={(e) => setOfficerForm({ ...officerForm, office: e.target.value as Office })}>
                {OFFICES.map((o) => (
                  <option key={o} value={o}>
                    {L.offices[o]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={L.titleLabel}>
              <Input value={officerForm.title} onChange={(e) => setOfficerForm({ ...officerForm, title: e.target.value })} />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  )
}
