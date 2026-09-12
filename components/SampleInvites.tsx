'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, Plus, Power } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select } from '@/components/ui'

interface Invite {
  id: string
  code: string
  label: string
  session_size: number
  sample_set: 'notation' | 'letters' | 'mixed'
  active: boolean
  created_at: string
}

const TEXT = {
  es: {
    title: 'Enlaces para recolectar letra',
    hint: 'Comparte un enlace con quien quieras, sin cuenta. Cada persona escribe sesiones de símbolos y todo se guarda aquí para el ajuste fino.',
    label: 'Para quién es',
    labelPlaceholder: 'Ej. Papás del equipo',
    size: 'Símbolos por sesión',
    set: 'Qué escriben',
    sets: { mixed: 'Jugadas y letras', notation: 'Solo jugadas', letters: 'Solo letras y números' },
    create: 'Crear enlace',
    copy: 'Copiar',
    copied: 'Copiado',
    samples: 'muestras',
    writers: 'personas',
    active: 'Activo',
    inactive: 'Apagado',
    turnOff: 'Apagar',
    turnOn: 'Encender',
    none: 'Todavía no hay enlaces.',
  },
  en: {
    title: 'Handwriting collection links',
    hint: 'Share a link with anyone, no account needed. Each person writes sessions of symbols and everything lands here for the fine-tuning.',
    label: 'Who it is for',
    labelPlaceholder: 'e.g. Team parents',
    size: 'Symbols per session',
    set: 'What they write',
    sets: { mixed: 'Plays and letters', notation: 'Plays only', letters: 'Letters and digits only' },
    create: 'Create link',
    copy: 'Copy',
    copied: 'Copied',
    samples: 'samples',
    writers: 'people',
    active: 'Active',
    inactive: 'Off',
    turnOff: 'Turn off',
    turnOn: 'Turn on',
    none: 'No links yet.',
  },
}

const newCode = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/** Manage public /write/<code> links and see what each one brought in. */
export default function SampleInvites() {
  const { language } = useLanguage()
  const L = TEXT[language === 'es' ? 'es' : 'en']
  const { canEdit, email } = usePermissions()
  const [invites, setInvites] = useState<Invite[]>([])
  const [counts, setCounts] = useState<Record<string, { samples: number; writers: number }>>({})
  const [label, setLabel] = useState('')
  const [size, setSize] = useState('25')
  const [set, setSet] = useState<Invite['sample_set']>('mixed')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [inv, samples] = await Promise.all([
      supabase.from('sample_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('handwriting_samples').select('invite_code, writer').not('invite_code', 'is', null).limit(20000),
    ])
    setInvites((inv.data as Invite[]) ?? [])
    const map: Record<string, { samples: number; writers: Set<string> }> = {}
    for (const row of (samples.data ?? []) as { invite_code: string; writer: string }[]) {
      if (!map[row.invite_code]) map[row.invite_code] = { samples: 0, writers: new Set() }
      map[row.invite_code].samples += 1
      map[row.invite_code].writers.add(row.writer)
    }
    setCounts(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { samples: v.samples, writers: v.writers.size }])))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const urlFor = (code: string) => `${origin}/write/${code}`

  const create = async () => {
    if (!label.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('sample_invites')
      .insert([{ code: newCode(), label: label.trim(), session_size: Math.max(5, Math.min(100, Number(size) || 25)), sample_set: set, created_by: email }])
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setLabel('')
    await load()
  }

  const toggle = async (inv: Invite) => {
    const { error: err } = await supabase.from('sample_invites').update({ active: !inv.active }).eq('id', inv.id)
    if (err) setError(err.message)
    await load()
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(urlFor(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  const canManage = canEdit('handwritingLab')

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Link2 className="size-4" />
        </span>
        <div>
          <CardTitle>{L.title}</CardTitle>
          <CardDescription>{L.hint}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {canManage && (
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_200px_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.label}</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={L.labelPlaceholder} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.size}</label>
              <Input type="number" min={5} max={100} value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.set}</label>
              <Select value={set} onChange={(e) => setSet(e.target.value as Invite['sample_set'])}>
                {(['mixed', 'notation', 'letters'] as const).map((k) => (
                  <option key={k} value={k}>
                    {L.sets[k]}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={create} loading={saving} disabled={!label.trim()}>
              <Plus /> {L.create}
            </Button>
          </div>
        )}
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L.none}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {invites.map((inv) => {
              const c = counts[inv.code] ?? { samples: 0, writers: 0 }
              return (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{inv.label}</span>
                      <Badge variant={inv.active ? 'success' : 'outline'}>{inv.active ? L.active : L.inactive}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {inv.session_size} · {L.sets[inv.sample_set]}
                      </span>
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">{urlFor(inv.code)}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.samples} {L.samples} · {c.writers} {L.writers}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(inv.code)}>
                    <Copy /> {copied === inv.code ? L.copied : L.copy}
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => toggle(inv)} title={inv.active ? L.turnOff : L.turnOn}>
                      <Power />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
