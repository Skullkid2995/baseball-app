'use client'

import { useId, useState } from 'react'
import { Crosshair, Shield, Zap } from 'lucide-react'
import { SCORING_PLAYS, scoringPlay, type PlayGroup, type ScoringPlay } from '@/lib/scorecard/plays'
import { cn } from '@/lib/utils'

export default function PlayPicker({ value, onChange, language, disabled = false, shared = false, outs = 0, runners = 0 }: {
  value: string; onChange: (value: string) => void; language: 'es' | 'en'; disabled?: boolean; shared?: boolean; outs?: number; runners?: number
}) {
  const es = language === 'es'
  const current = scoringPlay(value)
  const [browsing, setBrowsing] = useState<{ value: string; group: PlayGroup }>({ value, group: current?.group || 'hit' })
  const [typedDraft, setTypedDraft] = useState({ value, text: value, submitted: false })
  const typedHelpId = useId()
  const typedErrorId = useId()
  const typedText = typedDraft.value === value ? typedDraft.text : value
  const typedPlay = scoringPlay(typedText)
  const typedError = !typedPlay ? (es ? 'Escribe un código completo, como 6-3 o F8, o elige un resultado arriba.' : 'Enter a complete code, such as 6-3 or F8, or choose a result above.')
    : typedPlay.sharedOnly && !shared ? (es ? 'Este código no está disponible aquí. Elige un resultado arriba.' : 'This code is not available here. Choose a result above.')
    : unavailableReason(typedPlay)
  const showTypedError = typedDraft.value === value && typedDraft.submitted && !!typedError
  // A result chosen by handwriting should reveal its category too.
  const group = browsing.value === value ? browsing.group : current?.group || browsing.group
  const groups = [
    { id: 'hit' as const, label: es ? 'Hit' : 'Hit', Icon: Zap },
    { id: 'out' as const, label: 'Out', Icon: Shield },
    { id: 'reach' as const, label: es ? 'Llega a base' : 'Reach base', Icon: Crosshair },
  ]
  function unavailableReason(p: ScoringPlay) {
    return p.outs > 1 && outs + p.outs > 3 ? (es ? 'No quedan suficientes outs' : 'Not enough outs remaining')
      : p.outs > 1 && runners < p.outs - 1 ? (es ? `Requiere ${p.outs - 1} corredor${p.outs > 2 ? 'es' : ''}` : `Needs ${p.outs - 1} runner${p.outs > 2 ? 's' : ''} on base`)
      : ['SF', 'SAC'].includes(p.code) && outs >= 2 ? (es ? 'No disponible con 2 outs' : 'Unavailable with 2 outs')
      : ['SF', 'SAC'].includes(p.code) && runners === 0 ? (es ? 'Requiere un corredor en base' : 'Needs a runner on base') : ''
  }
  function confirmTypedCode() {
    if (disabled) return
    if (typedError) { setTypedDraft({ value, text: typedText, submitted: true }); return }
    onChange(typedText.trim().toUpperCase())
  }
  return <div className="space-y-3">
    <div data-keep-grid className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label={es ? 'Tipo de jugada' : 'Play category'}>
      {groups.map(({ id, label, Icon }) => <button key={id} type="button" disabled={disabled} aria-pressed={group === id} onClick={() => setBrowsing({ value, group: id })} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 text-base font-bold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500', group === id ? 'bg-white text-slate-950 shadow' : 'text-slate-300 hover:bg-slate-800', 'disabled:opacity-50')}><Icon aria-hidden="true" className="size-4 shrink-0" />{label}</button>)}
    </div>
    <div data-keep-grid className="grid grid-cols-2 gap-2">
      {SCORING_PLAYS.filter(p => p.group === group && (shared || !p.sharedOnly)).map(p => {
        const unavailable = unavailableReason(p)
        return <button type="button" key={p.code} disabled={disabled || !!unavailable} aria-pressed={current?.code === p.code} onClick={() => onChange(p.code)} className={cn('min-h-20 rounded-xl border px-3 py-3 text-left transition motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed', disabled && 'opacity-50', unavailable ? 'border-slate-200 bg-slate-100 text-slate-600' : current?.code === p.code ? group === 'out' ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500 text-rose-950' : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-950' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50')}>
          <span className="block text-base font-bold leading-snug">{p[language]}</span>
          <span className="mt-1 flex flex-wrap items-center justify-between gap-1 text-sm"><span className="break-all font-semibold">{p.code}</span>{p.outs > 0 && <span className="font-semibold">{p.outs} {p.outs > 1 ? 'outs' : 'out'}</span>}</span>
          {unavailable && <span className="mt-2 block text-sm leading-snug">{unavailable}</span>}
        </button>
      })}
    </div>
    <details className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700">
      <summary className="min-h-11 cursor-pointer py-3 text-base font-semibold">{es ? 'Escribir un código de jugada' : 'Type a play code'}</summary>
      <label className="mt-2 block text-sm">{es ? 'Opcional: usa los números de los fildeadores. Ej. 6-3, F8, L5, E6, 3U.' : 'Optional: use the fielders’ numbers. For example, 6-3, F8, L5, E6, 3U.'}
        <input aria-label={es ? 'Notación de jugada' : 'Play notation'} aria-describedby={`${typedHelpId}${showTypedError ? ` ${typedErrorId}` : ''}`} aria-invalid={showTypedError} autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="done" disabled={disabled} value={typedText} onChange={e => setTypedDraft({ value, text: e.target.value, submitted: false })} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); confirmTypedCode() } }} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-base uppercase" maxLength={20} />
      </label>
      <p id={typedHelpId} className="mt-2 text-sm">{es ? 'Escribe el código completo y toca «Confirmar código» o presiona Enter.' : 'Finish typing, then tap “Confirm code” or press Enter.'}</p>
      {showTypedError && <p id={typedErrorId} role="alert" className="mt-2 text-sm font-semibold text-rose-800">{typedError}</p>}
      {typedPlay && !typedError && <p className="mt-2 text-sm font-semibold">{typedText.trim().toUpperCase()} · {typedPlay[language]}</p>}
      <button type="button" disabled={disabled || !typedText.trim()} onClick={confirmTypedCode} className="mt-3 min-h-12 w-full rounded-lg bg-blue-700 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50">{es ? 'Confirmar código' : 'Confirm code'}</button>
    </details>
  </div>
}
