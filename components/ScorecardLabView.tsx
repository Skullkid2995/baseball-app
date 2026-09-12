'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Eraser, RotateCcw, Save, SkipForward, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, LoadingState, PageHeader } from '@/components/ui'
import ScorecardBox from '@/components/ScorecardBox'
import { TOKENS, describeToken } from '@/lib/handwriting/vocabulary'
import { normalize, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { interpretBox, type BaseRunners, type BoxAction } from '@/lib/scorecard/interpret'
import { BOX_SCENARIOS, type BoxExpectation } from '@/lib/scorecard/scenarios'
import { cn } from '@/lib/utils'

interface SampleRow {
  id: string
  writer: string
  scenario: string
  field_results: Record<string, boolean>
  all_correct: boolean
}

const WRITER_KEY = 'handwritingWriter' // shared with the handwriting lab
const ROUNDS = 2

type FieldKey = 'token' | 'bases' | 'out' | 'balls' | 'strikes' | 'hit'

function shortDevice(): string {
  const ua = navigator.userAgent
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : 'Other'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'
  return `${os} · ${browser}`
}

const sameBases = (a: BaseRunners, b: BaseRunners) => a.first === b.first && a.second === b.second && a.third === b.third && a.home === b.home
const basesText = (b: BaseRunners) => (b.home ? '1B 2B 3B H' : [b.first && '1B', b.second && '2B', b.third && '3B'].filter(Boolean).join(' ') || '—')

export default function ScorecardLabView() {
  const { language } = useLanguage()
  const [samples, setSamples] = useState<SampleRow[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [writer, setWriter] = useState('')
  const [index, setIndex] = useState(0)
  const [actions, setActions] = useState<BoxAction[]>([])
  const [pointerType, setPointerType] = useState('mouse')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const L = language === 'es'
    ? {
        title: 'Laboratorio de tarjeta',
        description: 'Escribe jugadas completas en la casilla clásica como lo harías en papel. La app dice qué entendió y guardamos la muestra para afinar la lectura.',
        writer: 'Nombre de quien escribe', writerHint: 'Mismo nombre que en el laboratorio de escritura.',
        needWriter: 'Escribe tu nombre para empezar.', sample: 'Jugada', of: 'de',
        happened: 'Qué pasó', onPaper: 'Cómo se escribe en papel',
        read: 'Lo que la app leyó', expected: 'esperado', field: { token: 'Jugada', bases: 'Bases', out: 'Out', balls: 'Bolas', strikes: 'Strikes', hit: 'Batazo' },
        noInk: 'sin escritura', noSamples: 'sin muestras de escritura aún', yes: 'sí', no: 'no',
        save: 'Guardar y siguiente', skip: 'Saltar', undo: 'Deshacer', clear: 'Borrar', redo: 'Repetir',
        done: '¡Ronda completa! Gracias.', restart: 'Otra ronda',
        stats: 'Precisión de lectura', total: 'muestras', writers: 'personas', allFields: 'jugadas leídas completas',
        perField: 'Por campo', worst: 'Escenarios con más errores', saved: 'Guardado',
      }
    : {
        title: 'Scorecard lab',
        description: 'Write complete plays in the classic box the way you would on paper. The app shows what it read and the sample is stored to tune the reading.',
        writer: "Writer's name", writerHint: 'Same name as in the handwriting lab.',
        needWriter: 'Enter your name to start.', sample: 'Play', of: 'of',
        happened: 'What happened', onPaper: 'How it is written on paper',
        read: 'What the app read', expected: 'expected', field: { token: 'Play', bases: 'Bases', out: 'Out', balls: 'Balls', strikes: 'Strikes', hit: 'Batted ball' },
        noInk: 'no writing', noSamples: 'no handwriting samples yet', yes: 'yes', no: 'no',
        save: 'Save and next', skip: 'Skip', undo: 'Undo', clear: 'Clear', redo: 'Redo',
        done: 'Round complete! Thank you.', restart: 'Another round',
        stats: 'Reading accuracy', total: 'samples', writers: 'writers', allFields: 'plays read fully right',
        perField: 'Per field', worst: 'Scenarios with most misreads', saved: 'Saved',
      }

  const sequence = useMemo(() => {
    const seq: string[] = []
    for (let r = 0; r < ROUNDS; r++) for (const s of BOX_SCENARIOS) seq.push(s.key)
    return seq
  }, [])
  const scenario = BOX_SCENARIOS.find((s) => s.key === sequence[index])
  const finished = index >= sequence.length

  useEffect(() => {
    try { const w = localStorage.getItem(WRITER_KEY); if (w) setWriter(w) } catch { /* ignore */ }
  }, [])

  const load = useCallback(async () => {
    const [samplesRes, hwRes] = await Promise.all([
      supabase.from('scorecard_samples').select('id, writer, scenario, field_results, all_correct').order('created_at', { ascending: true }).limit(5000),
      supabase.from('handwriting_samples').select('symbol, strokes').limit(5000),
    ])
    if (samplesRes.error) setError(samplesRes.error.message)
    setSamples((samplesRes.data || []) as SampleRow[])
    const allowed = new Set(TOKENS.map((t) => t.value))
    const rows = (hwRes.data || []) as { symbol: string; strokes: Stroke[] }[]
    setTemplates(rows.filter((r) => allowed.has(r.symbol)).map((r) => ({ symbol: r.symbol, cloud: normalize(r.strokes) })))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const interpretation = useMemo(() => interpretBox(actions, templates), [actions, templates])
  const { marks, tokenMatches } = interpretation
  const top = tokenMatches[0]

  // Compare what was read with the expectation
  const results = useMemo(() => {
    if (!scenario) return null
    const e: BoxExpectation = scenario.expected
    const r: Partial<Record<FieldKey, boolean>> = {}
    if (templates.length > 0 || marks.ink.length > 0) r.token = !!top && top.symbol === e.token
    r.bases = sameBases(marks.bases, e.bases)
    r.out = marks.outNumber === e.outNumber
    if (e.balls !== undefined) r.balls = marks.balls === e.balls
    if (e.strikes !== undefined) r.strikes = marks.strikes === e.strikes
    r.hit = !!marks.hitLine === !!e.hit
    return r
  }, [scenario, marks, top, templates.length])

  async function save() {
    if (!scenario || !writer.trim() || actions.length === 0 || !results) return
    setSaving(true)
    try { localStorage.setItem(WRITER_KEY, writer.trim()) } catch { /* ignore */ }
    const allCorrect = Object.values(results).every(Boolean)
    const interpreted = { token: top?.symbol ?? null, bases: marks.bases, out: marks.outNumber, balls: marks.balls, strikes: marks.strikes, hit: !!marks.hitLine }
    const { data, error } = await supabase
      .from('scorecard_samples')
      .insert([{
        writer: writer.trim(),
        scenario: scenario.key,
        actions,
        interpreted,
        expected: scenario.expected,
        field_results: results,
        all_correct: allCorrect,
        pointer_type: pointerType,
        device: shortDevice(),
      }])
      .select('id, writer, scenario, field_results, all_correct')
      .single()
    if (error) { setError(error.message); setSaving(false); return }
    // Alignment with the handwriting lab: the notation strokes are a labeled sample of the expected token
    if (marks.ink.length > 0) {
      await supabase.from('handwriting_samples').insert([{
        writer: writer.trim(),
        symbol: scenario.expected.token,
        strokes: marks.ink,
        recognized: top?.symbol ?? null,
        correct: top ? top.symbol === scenario.expected.token : null,
        pointer_type: pointerType,
        device: shortDevice(),
      }])
      setTemplates((prev) => [...prev, { symbol: scenario.expected.token, cloud: normalize(marks.ink) }])
    }
    setSamples((prev) => [...prev, data as SampleRow])
    setSaving(false)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1200)
    setActions([])
    setIndex((i) => i + 1)
  }

  const stats = useMemo(() => {
    const total = samples.length
    const writers = new Set(samples.map((s) => s.writer)).size
    const all = samples.filter((s) => s.all_correct).length
    const perField = new Map<string, { n: number; ok: number }>()
    const perScenario = new Map<string, { n: number; ok: number }>()
    for (const s of samples) {
      for (const [k, v] of Object.entries(s.field_results || {})) {
        const e = perField.get(k) || { n: 0, ok: 0 }
        e.n += 1; if (v) e.ok += 1; perField.set(k, e)
      }
      const sc = perScenario.get(s.scenario) || { n: 0, ok: 0 }
      sc.n += 1; if (s.all_correct) sc.ok += 1; perScenario.set(s.scenario, sc)
    }
    const worst = [...perScenario.entries()].map(([k, e]) => ({ key: k, n: e.n, rate: e.ok / e.n })).filter((r) => r.n >= 2).sort((a, b) => a.rate - b.rate).slice(0, 6)
    return { total, writers, all, perField: [...perField.entries()], worst }
  }, [samples])

  if (loading) return <LoadingState />

  const fieldRow = (key: FieldKey, read: string, expected: string) => {
    const ok = results?.[key]
    if (ok === undefined) return null
    return (
      <li key={key} className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm', ok ? 'bg-emerald-50' : 'bg-amber-50')}>
        <span className="w-20 shrink-0 font-medium text-slate-700">{L.field[key]}</span>
        <span className="flex-1 font-semibold tabular-nums">{read}</span>
        <span className="text-xs text-muted-foreground">{L.expected}: {expected}</span>
        {ok ? <Check className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-500" />}
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={L.title} description={L.description} />
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="p-5 sm:p-6">
          <FormField label={L.writer} hint={L.writerHint} className="mb-5 max-w-sm">
            <Input value={writer} onChange={(e) => setWriter(e.target.value)} placeholder="Ej. Miguel" />
          </FormField>

          {!writer.trim() ? (
            <Alert variant="info">{L.needWriter}</Alert>
          ) : finished || !scenario ? (
            <div className="space-y-4 py-6 text-center">
              <Check className="mx-auto size-10 text-emerald-600" />
              <p className="text-base font-medium">{L.done}</p>
              <Button onClick={() => setIndex(0)}><RotateCcw />{L.restart}</Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Prompt + reading */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.sample} {index + 1} {L.of} {sequence.length}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{scenario.title[language]}</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(index / sequence.length) * 100}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.happened}</p>
                  <p>{scenario.happened[language]}</p>
                  <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.onPaper}</p>
                  <p className="text-slate-700">{scenario.onPaper[language]}</p>
                </div>
                <div className="rounded-xl border border-border bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.read}</p>
                  <ul className="space-y-1.5">
                    {fieldRow('token', marks.ink.length === 0 ? L.noInk : templates.length === 0 ? L.noSamples : top ? `${top.symbol} · ${Math.round(top.score * 100)}%` : '—', `${scenario.expected.token} (${describeToken(scenario.expected.token, language)})`)}
                    {fieldRow('bases', basesText(marks.bases), basesText(scenario.expected.bases))}
                    {fieldRow('out', marks.outNumber ? String(marks.outNumber) : '—', scenario.expected.outNumber ? String(scenario.expected.outNumber) : '—')}
                    {fieldRow('balls', String(marks.balls), String(scenario.expected.balls ?? ''))}
                    {fieldRow('strikes', String(marks.strikes), String(scenario.expected.strikes ?? ''))}
                    {fieldRow('hit', marks.hitLine ? L.yes : L.no, scenario.expected.hit ? L.yes : L.no)}
                  </ul>
                </div>
              </div>

              {/* Box */}
              <div className="space-y-3">
                <div className="relative">
                  <ScorecardBox actions={actions} onChange={setActions} marks={marks} onPointerType={setPointerType} />
                  {justSaved && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/10">
                      <Badge variant="success" className="px-3 py-1 text-sm"><Check /> {L.saved}</Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setActions(actions.slice(0, -1))} disabled={actions.length === 0}><Undo2 />{L.undo}</Button>
                    <Button variant="outline" size="sm" onClick={() => setActions([])} disabled={actions.length === 0}><Eraser />{L.clear}</Button>
                  </div>
                  <Badge variant="outline">{pointerType}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setActions([]); setIndex((i) => i + 1) }}><SkipForward />{L.skip}</Button>
                  <Button className="flex-1" size="lg" onClick={save} disabled={actions.length === 0} loading={saving}><Save />{L.save}<ChevronRight /></Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{L.stats}</CardTitle>
            <CardDescription>{stats.total} {L.total} · {stats.writers} {L.writers}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">{stats.total ? `${Math.round((stats.all / stats.total) * 100)}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">{L.allFields} ({stats.all}/{stats.total})</p>
            </div>
            {stats.perField.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.perField}</p>
                <ul className="space-y-1.5">
                  {stats.perField.map(([k, e]) => (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className="w-16 font-medium">{L.field[k as FieldKey] ?? k}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className={cn('h-full', e.ok / e.n >= 0.8 ? 'bg-emerald-500' : e.ok / e.n >= 0.5 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${(e.ok / e.n) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round((e.ok / e.n) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats.worst.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.worst}</p>
                <ul className="space-y-1">
                  {stats.worst.map((w) => (
                    <li key={w.key} className="flex items-center justify-between text-sm">
                      <span>{BOX_SCENARIOS.find((s) => s.key === w.key)?.title[language] ?? w.key}</span>
                      <Badge variant={w.rate >= 0.8 ? 'success' : w.rate >= 0.5 ? 'warning' : 'danger'}>{Math.round(w.rate * 100)}%</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats.total === 0 && <p className="text-sm text-muted-foreground"><X className="mr-1 inline size-3.5" />—</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
