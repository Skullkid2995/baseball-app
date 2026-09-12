'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { KeyRound, Lock, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import {
  CONFIGURABLE_ROLES,
  FEATURES,
  ROLE_LABELS,
  ROLE_ORDER,
  isBootstrapAdmin,
  type AppUser,
  type ConfigurableRole,
  type PermissionMap,
  type Role,
} from '@/lib/permissions'
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Modal, Select } from '@/components/ui'

interface RosterPlayer {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  teams?: { name: string; city: string } | null
}

interface UserForm {
  id?: string
  email: string
  display_name: string
  role: Role
  player_id: string
  active: boolean
}

const EMPTY_FORM: UserForm = { email: '', display_name: '', role: 'player', player_id: '', active: true }

const TEXT = {
  es: {
    users: 'Usuarios',
    usersHint: 'Quién puede entrar con su cuenta de Google, con qué rol y, si quieres, ligado a un jugador.',
    addUser: 'Agregar usuario',
    editUser: 'Editar usuario',
    email: 'Correo de Google',
    name: 'Nombre',
    role: 'Rol',
    player: 'Jugador ligado (opcional)',
    noPlayer: 'Sin jugador',
    active: 'Puede entrar',
    inactive: 'Desactivado',
    owner: 'Dueño',
    you: 'tú',
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Quitar',
    confirmDelete: '¿Quitar el acceso de este usuario?',
    noUsers: 'Todavía no hay usuarios además de los dueños.',
    permissions: 'Permisos por rol',
    permissionsHint:
      'Qué puede ver y editar cada rol. Todo lo nuevo empieza apagado para todos hasta que lo enciendas aquí. Los super admin siempre ven y editan todo.',
    feature: 'Sección',
    view: 'Ver',
    edit: 'Editar',
    always: 'Siempre',
    saved: 'Guardado',
    saving: 'Guardando…',
    group: { main: 'Principal', analysis: 'Análisis', system: 'Sistema', actions: 'Acciones' },
    invalidEmail: 'Escribe un correo válido.',
    duplicate: 'Ese correo ya tiene acceso.',
  },
  en: {
    users: 'Users',
    usersHint: 'Who can sign in with their Google account, with which role and, optionally, tied to a player.',
    addUser: 'Add user',
    editUser: 'Edit user',
    email: 'Google email',
    name: 'Name',
    role: 'Role',
    player: 'Linked player (optional)',
    noPlayer: 'No player',
    active: 'Can sign in',
    inactive: 'Disabled',
    owner: 'Owner',
    you: 'you',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Remove',
    confirmDelete: 'Remove this user’s access?',
    noUsers: 'No users yet besides the owners.',
    permissions: 'Role permissions',
    permissionsHint:
      'What each role can view and edit. Anything new starts off for everyone until you turn it on here. Super admins always view and edit everything.',
    feature: 'Section',
    view: 'View',
    edit: 'Edit',
    always: 'Always',
    saved: 'Saved',
    saving: 'Saving…',
    group: { main: 'Main', analysis: 'Analysis', system: 'System', actions: 'Actions' },
    invalidEmail: 'Enter a valid email.',
    duplicate: 'That email already has access.',
  },
}

/** Super-admin only: manage who can sign in (app_users) and what each role can do (role_permissions). */
export default function AccessSettings() {
  const { language } = useLanguage()
  const lang = language === 'es' ? 'es' : 'en'
  const L = TEXT[lang]
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <UsersCard L={L} lang={lang} />
      <PermissionsCard L={L} lang={lang} />
    </div>
  )
}

type Text = (typeof TEXT)['es']

function UsersCard({ L, lang }: { L: Text; lang: 'es' | 'en' }) {
  const { email: myEmail, refresh } = usePermissions()
  const [users, setUsers] = useState<AppUser[]>([])
  const [players, setPlayers] = useState<RosterPlayer[]>([])
  const [form, setForm] = useState<UserForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [u, p] = await Promise.all([
      supabase.from('app_users').select('id, email, display_name, role, player_id, active, created_at').order('created_at'),
      supabase.from('players').select('id, first_name, last_name, jersey_number, teams ( name, city )').order('last_name'),
    ])
    setUsers((u.data as AppUser[]) ?? [])
    const roster = ((p.data ?? []) as unknown as RosterPlayer[]).filter((pl) => pl.teams?.city !== 'Opponent')
    setPlayers(roster)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const playerName = (id: string | null) => {
    const p = players.find((x) => x.id === id)
    if (!p) return null
    return `${p.first_name} ${p.last_name}${p.jersey_number != null ? ` #${p.jersey_number}` : ''}`
  }

  const openNew = () => {
    setError(null)
    setForm({ ...EMPTY_FORM })
  }
  const openEdit = (u: AppUser) => {
    setError(null)
    setForm({ id: u.id, email: u.email, display_name: u.display_name ?? '', role: u.role, player_id: u.player_id ?? '', active: u.active })
  }

  const save = async () => {
    if (!form) return
    const email = form.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(L.invalidEmail)
      return
    }
    if (users.some((u) => u.email.toLowerCase() === email && u.id !== form.id)) {
      setError(L.duplicate)
      return
    }
    setSaving(true)
    setError(null)
    const row = {
      email,
      display_name: form.display_name.trim() || null,
      role: form.role,
      player_id: form.player_id || null,
      active: form.active,
    }
    const res = form.id
      ? await supabase.from('app_users').update(row).eq('id', form.id)
      : await supabase.from('app_users').insert([{ ...row, created_by: myEmail }])
    setSaving(false)
    if (res.error) {
      setError(res.error.message)
      return
    }
    setForm(null)
    await load()
    await refresh()
  }

  const remove = async (u: AppUser) => {
    if (!confirm(L.confirmDelete)) return
    const { error: err } = await supabase.from('app_users').delete().eq('id', u.id)
    if (err) {
      setError(err.message)
      return
    }
    await load()
    await refresh()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>{L.users}</CardTitle>
          <CardDescription>{L.usersHint}</CardDescription>
        </div>
        <Button size="sm" onClick={openNew}>
          <UserPlus />
          {L.addUser}
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        {error && !form && (
          <Alert variant="error" className="mb-3">
            {error}
          </Alert>
        )}
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L.noUsers}</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const owner = isBootstrapAdmin(u.email)
              const linked = playerName(u.player_id)
              return (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-secondary-foreground">
                    {(u.display_name || u.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{u.display_name || u.email}</span>
                      {u.email.toLowerCase() === (myEmail ?? '').toLowerCase() && <Badge variant="primary">{L.you}</Badge>}
                      {owner && (
                        <Badge variant="outline">
                          <Lock /> {L.owner}
                        </Badge>
                      )}
                      {!u.active && <Badge variant="warning">{L.inactive}</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.display_name ? `${u.email} · ` : ''}
                      {ROLE_LABELS[u.role][lang]}
                      {linked ? ` · ${linked}` : ''}
                    </div>
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => openEdit(u)} aria-label={L.editUser}>
                    <Pencil />
                  </Button>
                  {!owner && (
                    <Button size="icon-sm" variant="ghost" onClick={() => remove(u)} aria-label={L.delete}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      {form && (
        <Modal
          onClose={() => setForm(null)}
          title={form.id ? L.editUser : L.addUser}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                {L.cancel}
              </Button>
              <Button onClick={save} loading={saving}>
                {L.save}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.email}</label>
              <Input
                type="email"
                value={form.email}
                disabled={!!form.id && isBootstrapAdmin(form.email)}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nombre@gmail.com"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.name}</label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.role}</label>
              <Select
                value={form.role}
                disabled={isBootstrapAdmin(form.email)}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r][lang]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.player}</label>
              <Select value={form.player_id} onChange={(e) => setForm({ ...form, player_id: e.target.value })}>
                <option value="">{L.noPlayer}</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                    {p.jersey_number != null ? ` #${p.jersey_number}` : ''}
                    {p.teams?.name ? ` · ${p.teams.name}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.active}
                disabled={isBootstrapAdmin(form.email)}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              {L.active}
            </label>
          </div>
        </Modal>
      )}
    </Card>
  )
}

function PermissionsCard({ L, lang }: { L: Text; lang: 'es' | 'en' }) {
  const { perms: loaded, refresh } = usePermissions()
  const [perms, setPerms] = useState<PermissionMap>(loaded)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPerms(loaded)
  }, [loaded])

  const get = (role: ConfigurableRole, feature: string) => perms[role]?.[feature] ?? { view: false, edit: false }

  const toggle = async (role: ConfigurableRole, feature: string, action: 'view' | 'edit', checked: boolean) => {
    const cur = get(role, feature)
    // edit implies view; removing view removes edit
    const next = action === 'view' ? { view: checked, edit: checked ? cur.edit : false } : { view: checked ? true : cur.view, edit: checked }
    setPerms((p) => ({ ...p, [role]: { ...(p[role] ?? {}), [feature]: next } }))
    setStatus('saving')
    setError(null)
    const { error: err } = await supabase
      .from('role_permissions')
      .upsert([{ role, feature, can_view: next.view, can_edit: next.edit }], { onConflict: 'role,feature' })
    if (err) {
      setStatus('error')
      setError(err.message)
      return
    }
    setStatus('saved')
    refresh()
  }

  const groups: Array<keyof Text['group']> = ['main', 'analysis', 'system', 'actions']

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>{L.permissions}</CardTitle>
          <CardDescription>{L.permissionsHint}</CardDescription>
        </div>
        <span className="text-xs text-muted-foreground">{status === 'saving' ? L.saving : status === 'saved' ? L.saved : ''}</span>
      </CardHeader>
      <CardContent className="pt-2">
        {error && (
          <Alert variant="error" className="mb-3">
            {error}
          </Alert>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 text-left font-semibold">{L.feature}</th>
                {CONFIGURABLE_ROLES.map((r) => (
                  <th key={r} colSpan={2} className="px-2 py-2 text-center font-semibold">
                    {ROLE_LABELS[r][lang]}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold">{ROLE_LABELS.super_admin[lang]}</th>
              </tr>
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th />
                {CONFIGURABLE_ROLES.map((r) => (
                  <Fragment key={r}>
                    <th className="px-1 py-1 text-center font-medium">
                      {L.view}
                    </th>
                    <th className="px-1 py-1 text-center font-medium">
                      {L.edit}
                    </th>
                  </Fragment>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const items = FEATURES.filter((f) => f.group === g)
                if (items.length === 0) return null
                return (
                  <FeatureGroupRows key={g} title={L.group[g]} items={items} lang={lang} get={get} toggle={toggle} always={L.always} />
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function FeatureGroupRows({
  title,
  items,
  lang,
  get,
  toggle,
  always,
}: {
  title: string
  items: typeof FEATURES
  lang: 'es' | 'en'
  get: (role: ConfigurableRole, feature: string) => { view: boolean; edit: boolean }
  toggle: (role: ConfigurableRole, feature: string, action: 'view' | 'edit', checked: boolean) => void
  always: string
}) {
  return (
    <>
      <tr>
        <td colSpan={2 + CONFIGURABLE_ROLES.length * 2} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </td>
      </tr>
      {items.map((f) => (
        <tr key={f.key} className="border-b border-border/60 last:border-0">
          <td className="py-2 pr-3">
            <div className="font-medium">{f.label[lang]}</div>
            <div className="text-xs text-muted-foreground">{f.hint[lang]}</div>
          </td>
          {CONFIGURABLE_ROLES.map((r) => {
            const p = get(r, f.key)
            return (
              <Fragment key={r}>
                <td className="px-1 py-2 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={p.view}
                    onChange={(e) => toggle(r, f.key, 'view', e.target.checked)}
                    aria-label={`${ROLE_LABELS[r][lang]} view ${f.label[lang]}`}
                  />
                </td>
                <td className="px-1 py-2 text-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={p.edit}
                    onChange={(e) => toggle(r, f.key, 'edit', e.target.checked)}
                    aria-label={`${ROLE_LABELS[r][lang]} edit ${f.label[lang]}`}
                  />
                </td>
              </Fragment>
            )
          })}
          <td className="px-2 py-2 text-center text-xs text-muted-foreground">{always}</td>
        </tr>
      ))}
    </>
  )
}
