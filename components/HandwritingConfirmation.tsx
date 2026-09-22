'use client'

import { ArrowDown, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { Match, Stroke } from '@/lib/handwriting/recognizer'
import { scoringPlay } from '@/lib/scorecard/plays'
import { cn } from '@/lib/utils'

export default function HandwritingConfirmation({ matches, ink, value, onConfirm, waiting, language, disabled = false, shared = false }: {
  matches: Match[]; ink: Stroke[]; value: string; onConfirm: (value: string) => void; waiting: boolean
  language: 'en' | 'es'; disabled?: boolean; shared?: boolean
}) {
  const headingId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const revealedInk = useRef('')
  const es = language === 'es'
  const selected = scoringPlay(value)
  const options = matches.filter(m => {
    const play = scoringPlay(m.symbol)
    return play && (shared || !play.sharedOnly)
  })
  const inkKey = JSON.stringify(ink)
  const hasOptions = options.length > 0
  useEffect(() => {
    if (inkKey === '[]') { revealedInk.current = ''; return }
    if (waiting || !hasOptions || revealedInk.current === inkKey) return
    revealedInk.current = inkKey
    // Bring the next step into view once the user finishes a new play code.
    // Count/base marks and choosing a result must not keep moving the editor.
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [inkKey, waiting, hasOptions])
  return <section ref={panelRef} aria-labelledby={headingId} className={cn('scroll-m-3 rounded-2xl border-2 p-3 sm:p-4', selected && !waiting ? 'border-emerald-400 bg-emerald-50' : 'border-blue-400 bg-blue-50')}>
    <h4 id={headingId} className="text-base font-black text-slate-950">{es ? '1 · Confirma el resultado' : '1 · Confirm your result'}</h4>
    <p role="status" className="mt-1 text-sm leading-snug text-slate-700">
      {waiting ? (es ? 'Termina de escribir. Las opciones aparecerán tras una pausa de 4 segundos.' : 'Finish writing. Your choices will appear after a 4-second pause.')
        : selected ? (es ? 'Resultado confirmado. Falta guardar la jugada.' : 'Result confirmed. Your play still needs to be saved.')
        : options.length ? (es ? 'Toca el botón que coincide con tu trazo para poder guardar.' : 'Tap the button that matches your writing to enable Save play.')
        : (es ? 'Escribe la jugada en el campo o elige un resultado de la lista.' : 'Write a play code on the field or choose a result from the list.')}
    </p>
    {!waiting && options.length > 0 && <div data-keep-grid className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map(m => {
        const play = scoringPlay(m.symbol)!
        const confirmed = value.toUpperCase() === m.symbol.toUpperCase()
        return <button type="button" key={m.symbol} disabled={disabled} aria-pressed={confirmed} onClick={() => onConfirm(m.symbol)}
          className={cn('flex min-h-[76px] items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-[0.98]', confirmed ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700')}>
          <span className="min-w-0"><span className="block break-words text-lg font-black">{confirmed ? (es ? 'Confirmado' : 'Confirmed') : (es ? 'Confirmar' : 'Confirm')} {m.symbol.toUpperCase()}</span><span className="mt-0.5 block text-sm">{play[language]}</span></span>
          {confirmed ? <CheckCircle2 aria-hidden="true" className="size-6 shrink-0" /> : <ArrowRight aria-hidden="true" className="size-6 shrink-0" />}
        </button>
      })}
    </div>}
    {selected && !waiting && <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-sm text-emerald-950">
      <ArrowDown aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p><strong className="block">{value.toUpperCase()} · {selected[language]}</strong>
        {shared ? (es ? 'Revisa los corredores y toca «Enviar a validar».' : 'Review the runners, then tap “Submit for validation”.')
          : (es ? 'Revisa los corredores e impulsadas y toca «Guardar jugada» abajo.' : 'Review runners and RBI, then tap “Save play” below.')}
      </p>
    </div>}
  </section>
}
