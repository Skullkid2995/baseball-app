'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Eraser, PenTool, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { LETTER_TOKENS, TOKENS, describeToken, type Token } from '@/lib/handwriting/vocabulary'
import type { Stroke } from '@/lib/handwriting/recognizer'
import BaseballMark from '@/components/BaseballMark'
import { Button, InkPad, Input } from '@/components/ui'

interface InviteInfo {
  label: string
  active: boolean
  session_size: number
  sample_set: 'notation' | 'letters' | 'mixed'
  samples: number
  writers: number
}

const TEXT = {
  es: {
    title: 'Ayúdanos con tu letra',
    intro: 'Estamos enseñando a la app a leer la anotación de béisbol escrita a mano. Escribe cada símbolo como lo harías en una hoja de anotación, con el dedo o un lápiz.',
    sessionOf: (n: number) => `Una sesión son ${n} símbolos, unos 3 minutos.`,
    name: 'Tu nombre o apodo',
    namePlaceholder: 'Ej. Miguel',
    start: 'Empezar',
    inactive: 'Este enlace ya no está activo.',
    notFound: 'Este enlace no existe.',
    loading: 'Cargando…',
    write: 'Escribe:',
    next: 'Siguiente',
    skip: 'Saltar',
    clear: 'Borrar',
    progress: (i: number, n: number) => `${i} de ${n}`,
    thanks: '¡Gracias!',
    thanksBody: (n: number) => `Guardamos ${n} muestras de tu letra.`,
    another: 'Otra sesión',
    done: 'Listo por hoy',
    saveError: 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.',
    totals: (s: number, w: number) => `${s} muestras de ${w} personas hasta ahora`,
    pen: 'lápiz', touch: 'dedo', mouse: 'mouse',
  },
  en: {
    title: 'Help us with your handwriting',
    intro: 'We are teaching the app to read handwritten baseball scoring. Write each symbol the way you would on a scorecard, with a finger or a stylus.',
    sessionOf: (n: number) => `A session is ${n} symbols, about 3 minutes.`,
    name: 'Your name or nickname',
    namePlaceholder: 'e.g. Mike',
    start: 'Start',
    inactive: 'This link is no longer active.',
    notFound: 'This link does not exist.',
    loading: 'Loading…',
    write: 'Write:',
    next: 'Next',
    skip: 'Skip',
    clear: 'Clear',
    progress: (i: number, n: number) => `${i} of ${n}`,
    thanks: 'Thank you!',
    thanksBody: (n: number) => `We saved ${n} samples of your handwriting.`,
    another: 'Another session',
    done: 'Done for today',
    saveError: 'Could not save. Check your connection and try again.',
    totals: (s: number, w: number) => `${s} samples from ${w} people so far`,
    pen: 'stylus', touch: 'finger', mouse: 'mouse',
  },
}

function shortDevice(): string {
  const ua = navigator.userAgent
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh/.test(ua) ? 'Mac'
    : 'other'
  return `${os} ${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
}

/** A session: notation tokens and letters/digits shuffled, no repeats until the pool runs out. */
function buildSession(set: InviteInfo['sample_set'], size: number): Token[] {
  const pool = set === 'notation' ? [...TOKENS] : set === 'letters' ? [...LETTER_TOKENS] : [...TOKENS, ...LETTER_TOKENS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const out: Token[] = []
  while (out.length < size) out.push(...pool.slice(0, size - out.length))
  return out
}

/**
 * Public page (/write/<code>): anyone with the link writes sessions of samples
 * for the handwriting fine-tuning. No account: inserts are allowed only with a
 * live invite code (RLS), and every sample is tagged with the code and session.
 */
export default function PublicSampleSession({ code }: { code: string }) {
  const [lang, setLang] = useState<'es' | 'en'>('es')
  const L = TEXT[lang]
  const supabase = useMemo(() => createClient(), [])
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined)
  const [writer, setWriter] = useState('')
  const [phase, setPhase] = useState<'intro' | 'session' | 'thanks'>('intro')
  const [session, setSession] = useState<Token[]>([])
  const [sessionId, setSessionId] = useState('')
  const [index, setIndex] = useState(0)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [pointerType, setPointerType] = useState('mouse')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  const loadInfo = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('sample_invite_info', { p_code: code })
    if (err || !data) {
      setInfo(null)
      return
    }
    setInfo(data as InviteInfo)
  }, [supabase, code])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('handwritingWriter')
      if (saved) setWriter(saved)
      const l = localStorage.getItem('language')
      if (l === 'en' || l === 'es') setLang(l)
    } catch {
      // ignore
    }
    loadInfo()
  }, [loadInfo])

  const start = () => {
    if (!info || !writer.trim()) return
    try {
      localStorage.setItem('handwritingWriter', writer.trim())
    } catch {
      // ignore
    }
    setSession(buildSession(info.sample_set, info.session_size))
    setSessionId(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
    setIndex(0)
    setStrokes([])
    setSavedCount(0)
    setError(null)
    setPhase('session')
  }

  const current = session[index]
  const advance = () => {
    setStrokes([])
    if (index + 1 >= session.length) {
      setPhase('thanks')
      loadInfo()
    } else setIndex(index + 1)
  }

  const save = async () => {
    if (!current || strokes.length === 0 || saving) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('handwriting_samples').insert([
      {
        writer: writer.trim(),
        symbol: current.value,
        strokes,
        pointer_type: pointerType,
        device: shortDevice(),
        invite_code: code,
        session_id: sessionId,
      },
    ])
    setSaving(false)
    if (err) {
      setError(L.saveError)
      return
    }
    setSavedCount((n) => n + 1)
    advance()
  }

  const pointerLabel = pointerType === 'pen' ? L.pen : pointerType === 'touch' ? L.touch : L.mouse

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BaseballMark className="size-4" />
          </span>
          <div className="text-sm font-semibold">{info?.label ?? 'Baseball Stats'}</div>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          {(['es', 'en'] as const).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-md px-2.5 py-1 uppercase ${lang === l ? 'bg-card shadow-sm' : 'text-slate-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6">
        {info === undefined && <p className="text-center text-sm text-muted-foreground">{L.loading}</p>}
        {info === null && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">{L.notFound}</p>}
        {info && !info.active && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">{L.inactive}</p>}

        {info && info.active && phase === 'intro' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{L.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{L.intro}</p>
              <p className="mt-1 text-sm text-muted-foreground">{L.sessionOf(info.session_size)}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.name}</label>
              <Input value={writer} onChange={(e) => setWriter(e.target.value)} placeholder={L.namePlaceholder} autoFocus />
            </div>
            <Button size="lg" className="w-full" disabled={!writer.trim()} onClick={start}>
              <PenTool /> {L.start}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{L.totals(info.samples, info.writers)}</p>
          </div>
        )}

        {info && info.active && phase === 'session' && current && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>{writer}</span>
              <span>{L.progress(index + 1, session.length)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(index / session.length) * 100}%` }} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.write}</p>
              <div className="my-1 text-6xl font-bold tabular-nums tracking-tight">{current.value}</div>
              <p className="text-sm text-muted-foreground">{describeToken(current.value, lang)}</p>
            </div>
            <InkPad strokes={strokes} onChange={setStrokes} onStrokeEnd={setPointerType} className="aspect-square w-full" />
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => setStrokes([])} disabled={strokes.length === 0}>
                <Eraser /> {L.clear}
              </Button>
              <Button variant="ghost" onClick={advance}>
                <RotateCcw /> {L.skip}
              </Button>
              <Button onClick={save} loading={saving} disabled={strokes.length === 0}>
                {L.next} <ChevronRight />
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">{pointerLabel}</p>
          </div>
        )}

        {info && info.active && phase === 'thanks' && (
          <div className="space-y-5 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="size-8" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">{L.thanks}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.thanksBody(savedCount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{L.totals(info.samples, info.writers)}</p>
            </div>
            <div className="flex justify-center gap-2">
              <Button size="lg" onClick={start}>
                <PenTool /> {L.another}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setPhase('intro')}>
                {L.done}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
