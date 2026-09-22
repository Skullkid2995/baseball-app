import { notationInk } from '@/lib/scorecard/notationInk'

export default function NotationGuide({ notation, language = 'en' }: { notation: string; language?: 'en' | 'es' }) {
  if (!notation) return null
  const strokes = notationInk(notation, { centerX: 50, top: 7, width: 88, height: 26 })
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-[#fffdf7] px-3 py-2">
    <div className="min-w-0 text-xs text-slate-600"><p className="font-bold text-slate-800">{language === 'es' ? 'Así se escribe a mano' : 'How to write it by hand'}</p><p>{notation.toUpperCase()}</p></div>
    <svg viewBox="0 0 100 40" role="img" aria-label={`${language === 'es' ? 'Ejemplo a mano' : 'Handwritten example'}: ${notation.toUpperCase()}`} className="h-11 w-28 shrink-0">
      {strokes.map((stroke, i) => <polyline key={i} points={stroke.map(p => p.join(',')).join(' ')} fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  </div>
}
