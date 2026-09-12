'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Eraser, PenTool, RotateCcw, Save, SkipForward, Undo2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import SampleInvites from './SampleInvites'
import { useLanguage } from '@/contexts/LanguageContext'
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, InkPad, Input, LoadingState, PageHeader } from '@/components/ui'
import { describeToken, tokensFor, type SampleSet } from '@/lib/handwriting/vocabulary'
import { normalize, recognize, type Match, type Stroke, type Template } from '@/lib/handwriting/recognizer'
import { cn } from '@/lib/utils'

interface SampleRow {
  id: string
  writer: string
  symbol: string
  strokes: Stroke[]
  recognized: string | null
  correct: boolean | null
  pointer_type: string | null
}

const REPEATS = 3
const WRITER_KEY = 'handwritingWriter'

function shortDevice(): string {
  const ua = navigator.userAgent
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh/.test(ua) ? 'Mac'
    : 'Other'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'
  return `${os} · ${browser}`
}

export default function HandwritingLabView() {
  const { language } = useLanguage()
  const [samples, setSamples] = useState<SampleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [writer, setWriter] = useState('')
  const [mode, setMode] = useState<'collect' | 'test'>('collect')
  const [set, setSet] = useState<SampleSet>('notation')
  const [index, setIndex] = useState(0)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [pointerType, setPointerType] = useState('mouse')
  const [saving, setSaving] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [justSaved, setJustSaved] = useState<string | null>(null)
  const [testChoice, setTestChoice] = useState<string | null>(null)

  const L = language === 'es'
    ? {
        title: 'Laboratorio de escritura',
        description: 'Recolecta muestras de la notación del scorecard escritas a mano para afinar el reconocimiento.',
        writer: 'Nombre de quien escribe',
        writerHint: 'Cada persona escribe cada símbolo varias veces. Usa el dedo, un stylus o el mouse.',
        collect: 'Recolectar',
        test: 'Probar',
        write: 'Escribe',
        progress: 'Muestra',
        of: 'de',
        save: 'Guardar y siguiente',
        skip: 'Saltar',
        undo: 'Deshacer',
        clear: 'Borrar',
        recognized: 'Reconocido',
        noTemplates: 'Aún no hay muestras para comparar. Las primeras muestras entrenan el reconocedor.',
        confidence: 'confianza',
        saved: 'Guardado',
        done: '¡Ronda completa! Gracias. Puedes volver a empezar o pasar a Probar.',
        restart: 'Empezar otra ronda',
        stats: 'Estado del reconocedor',
        totalSamples: 'muestras',
        writers: 'personas',
        accuracy: 'aciertos al guardar',
        perSymbol: 'Precisión por símbolo',
        testHint: 'Escribe cualquier símbolo. Confirma si el reconocimiento fue correcto o corrígelo; también se guarda como muestra.',
        correct: 'Correcto',
        fix: 'Corregir',
        redo: 'Repetir',
        pickSymbol: 'Elige el símbolo que quisiste escribir',
        needWriter: 'Escribe tu nombre para empezar.',
        pen: 'stylus',
        touch: 'dedo',
        mouse: 'mouse',
        setNotation: 'Notación',
        setLetters: 'Letras y números',
        setHint: 'Notación: símbolos del scorecard. Letras y números: para nombres de jugadores y números de camiseta, una letra por celda.',
      }
    : {
        title: 'Handwriting lab',
        description: 'Collect handwritten samples of scorecard notation to tune the recognizer.',
        writer: "Writer's name",
        writerHint: 'Each person writes every symbol a few times. Finger, stylus or mouse all work.',
        collect: 'Collect',
        test: 'Test',
        write: 'Write',
        progress: 'Sample',
        of: 'of',
        save: 'Save and next',
        skip: 'Skip',
        undo: 'Undo',
        clear: 'Clear',
        recognized: 'Recognized',
        noTemplates: 'No samples to compare against yet. The first samples train the recognizer.',
        confidence: 'confidence',
        saved: 'Saved',
        done: 'Round complete! Thank you. Start another round or switch to Test.',
        restart: 'Start another round',
        stats: 'Recognizer status',
        totalSamples: 'samples',
        writers: 'writers',
        accuracy: 'correct on save',
        perSymbol: 'Accuracy per symbol',
        testHint: 'Write any symbol. Confirm whether the recognition was right or fix it; it is stored as a sample too.',
        correct: 'Correct',
        fix: 'Fix',
        redo: 'Redo',
        pickSymbol: 'Pick the symbol you meant',
        needWriter: 'Enter your name to start.',
        pen: 'stylus',
        touch: 'finger',
        mouse: 'mouse',
        setNotation: 'Notation',
        setLetters: 'Letters and digits',
        setHint: 'Notation: scorecard symbols. Letters and digits: for player names and jersey numbers, one character per cell.',
      }

  // Prompt sequence: every token, REPEATS times, interleaved so the same token is not written back to back
  const activeTokens = useMemo(() => tokensFor(set), [set])
  const sequence = useMemo(() => {
    const seq: string[] = []
    for (let r = 0; r < REPEATS; r++) for (const t of activeTokens) seq.push(t.value)
    return seq
  }, [activeTokens])
  const current = sequence[index]
  const finished = index >= sequence.length

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WRITER_KEY)
      if (saved) setWriter(saved)
    } catch {
      // ignore
    }
  }, [])

  const loadSamples = useCallback(async () => {
    const { data, error } = await supabase
      .from('handwriting_samples')
      .select('id, writer, symbol, strokes, recognized, correct, pointer_type')
      .order('created_at', { ascending: true })
      .limit(5000)
    if (error) {
      setError(error.message)
    } else {
      setSamples((data || []) as SampleRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSamples()
  }, [loadSamples])

  // Only compare against the symbols of the active set (a notation 'K' and a letter 'K' are the same glyph, so both count)
  const templates = useMemo<Template[]>(() => {
    const allowed = new Set(activeTokens.map((t) => t.value))
    return samples.filter((s) => allowed.has(s.symbol)).map((s) => ({ symbol: s.symbol, cloud: normalize(s.strokes) }))
  }, [samples, activeTokens])

  // Re-run recognition whenever the drawing changes
  useEffect(() => {
    setMatches(strokes.length ? recognize(strokes, templates).slice(0, 3) : [])
  }, [strokes, templates])

  const top = matches[0]

  async function saveSample(symbol: string) {
    if (!writer.trim() || strokes.length === 0) return
    setSaving(true)
    try {
      localStorage.setItem(WRITER_KEY, writer.trim())
    } catch {
      // ignore
    }
    const recognized = top?.symbol ?? null
    const { data, error } = await supabase
      .from('handwriting_samples')
      .insert([{
        writer: writer.trim(),
        symbol,
        strokes,
        recognized,
        correct: recognized ? recognized === symbol : null,
        pointer_type: pointerType,
        device: shortDevice(),
      }])
      .select('id, writer, symbol, strokes, recognized, correct, pointer_type')
      .single()
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSamples((prev) => [...prev, data as SampleRow])
    setJustSaved(symbol)
    setTimeout(() => setJustSaved(null), 1200)
    setStrokes([])
    setTestChoice(null)
    if (mode === 'collect') setIndex((i) => i + 1)
  }

  const stats = useMemo(() => {
    const graded = samples.filter((s) => s.correct !== null)
    const correct = graded.filter((s) => s.correct).length
    const writers = new Set(samples.map((s) => s.writer)).size
    const perSymbol = new Map<string, { n: number; ok: number }>()
    for (const s of graded) {
      const e = perSymbol.get(s.symbol) || { n: 0, ok: 0 }
      e.n += 1
      if (s.correct) e.ok += 1
      perSymbol.set(s.symbol, e)
    }
    const worst = [...perSymbol.entries()]
      .map(([symbol, e]) => ({ symbol, n: e.n, rate: e.ok / e.n }))
      .filter((r) => r.n >= 2)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8)
    return { total: samples.length, writers, graded: graded.length, correct, worst }
  }, [samples])

  if (loading) return <LoadingState />

  const pointerLabel = pointerType === 'pen' ? L.pen : pointerType === 'touch' ? L.touch : L.mouse

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.title}
        description={L.description}
        actions={
          <div className="inline-flex items-center rounded-lg bg-secondary p-0.5">
            {(['collect', 'test'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setStrokes([]); setTestChoice(null) }}
                aria-pressed={mode === m}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'collect' ? L.collect : L.test}
              </button>
            ))}
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Public links: collect samples from anyone, no account */}
      <SampleInvites />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Writing area */}
        <Card className="p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end">
            <FormField label={L.writer} hint={L.writerHint} className="max-w-sm flex-1">
              <Input value={writer} onChange={(e) => setWriter(e.target.value)} placeholder="Ej. Miguel" />
            </FormField>
            <div className="inline-flex items-center self-start rounded-lg bg-secondary p-0.5 sm:mb-6" role="group" title={L.setHint}>
              {(['notation', 'letters'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSet(s); setIndex(0); setStrokes([]); setTestChoice(null) }}
                  aria-pressed={set === s}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    set === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s === 'notation' ? L.setNotation : L.setLetters}
                </button>
              ))}
            </div>
          </div>

          {!writer.trim() ? (
            <Alert variant="info">{L.needWriter}</Alert>
          ) : mode === 'collect' && finished ? (
            <div className="space-y-4 py-6 text-center">
              <Check className="mx-auto size-10 text-emerald-600" />
              <p className="text-base font-medium">{L.done}</p>
              <Button onClick={() => setIndex(0)}>
                <RotateCcw />
                {L.restart}
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Prompt + result */}
              <div className="space-y-4">
                {mode === 'collect' ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {L.progress} {index + 1} {L.of} {sequence.length}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{L.write}:</p>
                    <p className="text-6xl font-bold tracking-tight tabular-nums">{current}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{describeToken(current, language)}</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-all" style={{ width: `${(index / sequence.length) * 100}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{L.testHint}</p>
                )}

                {/* Recognition */}
                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.recognized}</p>
                  {templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{L.noTemplates}</p>
                  ) : matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-bold tabular-nums">{top.symbol}</span>
                        <span className="text-sm text-muted-foreground">{describeToken(top.symbol, language)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matches.map((m, i) => (
                          <Badge key={m.symbol} variant={i === 0 ? (m.score > 0.7 ? 'success' : 'warning') : 'outline'}>
                            {m.symbol} · {Math.round(m.score * 100)}% {i === 0 ? L.confidence : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {mode === 'test' && strokes.length > 0 && (
                  <div className="space-y-3">
                    {testChoice === null ? (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="success" size="lg" disabled={!top} onClick={() => top && saveSample(top.symbol)} loading={saving}>
                          <Check />
                          {L.correct}
                        </Button>
                        <Button variant="outline" size="lg" onClick={() => setTestChoice('fix')}>
                          <PenTool />
                          {L.fix}
                        </Button>
                        <Button variant="ghost" size="lg" onClick={() => setStrokes([])}>
                          <RotateCcw />
                          {L.redo}
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2 text-sm font-medium">{L.pickSymbol}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeTokens.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => saveSample(t.value)}
                              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:border-primary hover:bg-accent"
                            >
                              {t.value}
                            </button>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => setTestChoice(null)}>
                            <X />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pad */}
              <div className="space-y-3">
                <div className="relative">
                  <InkPad strokes={strokes} onChange={setStrokes} onStrokeEnd={setPointerType} hint={mode === 'collect' ? current : undefined} />
                  {justSaved && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/10">
                      <Badge variant="success" className="px-3 py-1 text-sm"><Check /> {L.saved} {justSaved}</Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setStrokes(strokes.slice(0, -1))} disabled={strokes.length === 0}>
                      <Undo2 />
                      {L.undo}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setStrokes([])} disabled={strokes.length === 0}>
                      <Eraser />
                      {L.clear}
                    </Button>
                  </div>
                  <Badge variant="outline">{pointerLabel}</Badge>
                </div>
                {mode === 'collect' && (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setStrokes([]); setIndex((i) => i + 1) }}>
                      <SkipForward />
                      {L.skip}
                    </Button>
                    <Button className="flex-1" size="lg" onClick={() => saveSample(current)} disabled={strokes.length === 0} loading={saving}>
                      <Save />
                      {L.save}
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Stats */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{L.stats}</CardTitle>
            <CardDescription>
              {stats.total} {L.totalSamples} · {stats.writers} {L.writers}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">
                {stats.graded ? `${Math.round((stats.correct / stats.graded) * 100)}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{L.accuracy} ({stats.correct}/{stats.graded})</p>
            </div>
            {stats.worst.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.perSymbol}</p>
                <ul className="space-y-1.5">
                  {stats.worst.map((r) => (
                    <li key={r.symbol} className="flex items-center gap-2 text-sm">
                      <span className="w-12 font-semibold tabular-nums">{r.symbol}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className={cn('h-full', r.rate >= 0.8 ? 'bg-emerald-500' : r.rate >= 0.5 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${r.rate * 100}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(r.rate * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
