'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Play, RotateCcw, Save, Scale } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, LoadingState, PageHeader, Select } from '@/components/ui'
import { DEFAULT_RULES, RULE_DEFINITIONS, RULE_GROUPS, mergeRules, type RuleSet } from '@/lib/rules/config'
import { applyEvent, createGame, era, inningsPitched, type GameState } from '@/lib/rules/engine'
import { SCENARIOS, demoLineup } from '@/lib/rules/scenarios'
import { cn } from '@/lib/utils'

const RULE_SET_NAME = 'default'

export default function RulesView() {
  const { language } = useLanguage()
  const [rules, setRules] = useState<RuleSet>(DEFAULT_RULES)
  const [saved, setSaved] = useState<RuleSet>(DEFAULT_RULES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scenarioKey, setScenarioKey] = useState(SCENARIOS[0].key)
  const [tab, setTab] = useState<'rules' | 'logic'>('rules')

  const L = language === 'es'
    ? {
        title: 'Reglas',
        description: 'Las reglas que aplica el motor de anotación. Cámbialas aquí y el simulador muestra cómo decide.',
        tabRules: 'Reglas',
        tabLogic: 'Lógica',
        save: 'Guardar reglas',
        reset: 'Valores por defecto',
        savedOk: 'Reglas guardadas',
        unsaved: 'Cambios sin guardar',
        simulator: 'Simulador',
        simulatorHint: 'Elige una situación. El motor la juega con las reglas actuales (incluidos los cambios sin guardar) y explica cada decisión.',
        run: 'Situación',
        decisions: 'Decisiones del motor',
        result: 'Resultado',
        final: 'Final',
        inProgress: 'En juego',
        inning: 'Entrada',
        top: 'alta',
        bottom: 'baja',
        outs: 'outs',
        runners: 'Corredores',
        none: 'ninguno',
        violations: 'Avisos y reglas aplicadas',
        pitching: 'Línea de pitcheo',
        batting: 'Bateo',
        us: 'Nosotros',
        them: 'Rival',
        howItWorks: 'Cómo funciona',
        howText: 'Cada anotación es un evento (lanzamiento, pelota en juego, corredor, cambio). El motor aplica los eventos en orden y calcula cuenta, outs, corredores, marcador, turno al bat y las líneas de cada lanzador y bateador. Corregir es anular un evento y volver a aplicar los demás. Con dos anotadores, se aplican las dos listas y se comparan los estados: cualquier diferencia se marca para revisión.',
      }
    : {
        title: 'Rules',
        description: 'The rules the scoring engine applies. Change them here and the simulator shows how it decides.',
        tabRules: 'Rules',
        tabLogic: 'Logic',
        save: 'Save rules',
        reset: 'Reset to defaults',
        savedOk: 'Rules saved',
        unsaved: 'Unsaved changes',
        simulator: 'Simulator',
        simulatorHint: 'Pick a situation. The engine plays it with the current rules (including unsaved changes) and explains every decision.',
        run: 'Situation',
        decisions: 'Engine decisions',
        result: 'Result',
        final: 'Final',
        inProgress: 'In progress',
        inning: 'Inning',
        top: 'top',
        bottom: 'bottom',
        outs: 'outs',
        runners: 'Runners',
        none: 'none',
        violations: 'Warnings and rules applied',
        pitching: 'Pitching line',
        batting: 'Batting',
        us: 'Us',
        them: 'Opponent',
        howItWorks: 'How it works',
        howText: 'Every scoring action is an event (pitch, ball in play, runner, substitution). The engine applies events in order and derives count, outs, runners, score, whose turn it is, and every pitcher and batter line. A correction voids an event and re-applies the rest. With two scorers, both event lists are applied and the states compared: any difference is flagged for review.',
      }

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('rule_sets').select('rules').eq('name', RULE_SET_NAME).maybeSingle()
      if (error) setError(error.message)
      const merged = mergeRules((data?.rules as Partial<RuleSet>) || null)
      setRules(merged)
      setSaved(merged)
      setLoading(false)
    }
    load()
  }, [])

  const dirty = JSON.stringify(rules) !== JSON.stringify(saved)

  async function save() {
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('rule_sets').upsert({ name: RULE_SET_NAME, rules }, { onConflict: 'name' })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSaved(rules)
  }

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) || SCENARIOS[0]
  const simulation = useMemo<GameState>(() => {
    let state = createGame({
      rules: { ...rules, ...(scenario.rules || {}) },
      battingFirst: scenario.battingFirst || 'home',
      lineups: { home: demoLineup('home', scenario.key === 'dh'), opponent: demoLineup('opponent') },
    })
    for (const e of scenario.events) state = applyEvent(state, e)
    return state
  }, [rules, scenario])

  if (loading) return <LoadingState />

  const setValue = (key: keyof RuleSet, value: boolean | number | string) => setRules((r) => ({ ...r, [key]: value }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={L.title}
        description={L.description}
        actions={
          <div className="inline-flex items-center rounded-lg bg-secondary p-0.5">
            {(['rules', 'logic'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {t === 'rules' ? L.tabRules : L.tabLogic}
              </button>
            ))}
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {tab === 'rules' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && <Badge variant="warning"><AlertTriangle /> {L.unsaved}</Badge>}
            <Button variant="outline" onClick={() => setRules(DEFAULT_RULES)}>
              <RotateCcw />
              {L.reset}
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              <Save />
              {L.save}
            </Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {RULE_GROUPS.map((group) => (
              <Card key={group.key}>
                <CardHeader>
                  <CardTitle>{group[language]}</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {RULE_DEFINITIONS.filter((d) => d.group === group.key).map((def) => {
                    const value = rules[def.key]
                    return (
                      <div key={def.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{def.label[language]}</p>
                          <p className="text-xs text-muted-foreground">{def.description[language]}</p>
                        </div>
                        <div className="shrink-0">
                          {def.type === 'boolean' && (
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <Checkbox checked={Boolean(value)} onChange={(e) => setValue(def.key, e.target.checked)} />
                            </label>
                          )}
                          {def.type === 'number' && (
                            <Input
                              type="number"
                              className="w-24 text-right"
                              min={def.min}
                              max={def.max}
                              value={Number(value)}
                              onChange={(e) => setValue(def.key, Number(e.target.value))}
                            />
                          )}
                          {def.type === 'select' && (
                            <Select className="w-52" value={String(value)} onChange={(e) => setValue(def.key, Number(e.target.value))}>
                              {def.options?.map((o) => (
                                <option key={o.value} value={o.value}>{o[language]}</option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'logic' && (
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Scale className="size-4" /></span>
              <div>
                <CardTitle>{L.howItWorks}</CardTitle>
                <CardDescription>{L.howText}</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>{L.simulator}</CardTitle>
                <CardDescription>{L.simulatorHint}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {SCENARIOS.map((s) => (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => setScenarioKey(s.key)}
                        aria-pressed={s.key === scenarioKey}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          s.key === scenarioKey ? 'bg-accent text-accent-foreground' : 'hover:bg-slate-50'
                        )}
                      >
                        <Play className="mt-0.5 size-3.5 shrink-0" />
                        <span>{s.title[language]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">{scenario.description[language]}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Badge variant={simulation.status === 'final' ? 'dark' : 'success'}>
                    {simulation.status === 'final' ? `${L.final}${simulation.finalReason ? ` · ${simulation.finalReason}` : ''}` : L.inProgress}
                  </Badge>
                  <span className="text-2xl font-bold tabular-nums">{simulation.score.home} – {simulation.score.opponent}</span>
                  <span className="text-sm text-muted-foreground">
                    {L.inning} {simulation.inning} ({simulation.half === 'top' ? L.top : L.bottom}) · {simulation.outs} {L.outs}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {L.runners}: {simulation.runners.length ? simulation.runners.sort((a, b) => a.base - b.base).map((r) => `${r.name} (${r.base}B)`).join(', ') : L.none}
                  </span>
                </div>
              </Card>

              {simulation.violations.length > 0 && (
                <Card className="p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.violations}</p>
                  <ul className="space-y-1.5">
                    {simulation.violations.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        <span><Badge variant="outline" className="mr-2">{v.code}</Badge>{v.message[language]}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="overflow-hidden">
                <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.decisions}</div>
                <ol className="max-h-[420px] divide-y divide-border overflow-y-auto scrollbar-thin text-sm">
                  {simulation.decisions.map((d, i) => (
                    <li key={i} className={cn('flex gap-3 px-5 py-1.5', d.text.es.startsWith('⚠') && 'bg-amber-50')}>
                      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">{d.inning}{d.half === 'top' ? '▲' : '▼'} #{d.seq}</span>
                      <span>{d.text[language]}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.pitching}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2">P</th>
                        <th className="px-2 py-2 text-right">IP</th>
                        <th className="px-2 py-2 text-right">BF</th>
                        <th className="px-2 py-2 text-right">NP</th>
                        <th className="px-2 py-2 text-right">S</th>
                        <th className="px-2 py-2 text-right">B</th>
                        <th className="px-2 py-2 text-right">H</th>
                        <th className="px-2 py-2 text-right">R</th>
                        <th className="px-2 py-2 text-right">ER</th>
                        <th className="px-2 py-2 text-right">BB</th>
                        <th className="px-2 py-2 text-right">K</th>
                        <th className="px-2 py-2 text-right">HBP</th>
                        <th className="px-2 py-2 text-right">HR</th>
                        <th className="px-2 py-2 text-right">WP</th>
                        <th className="px-2 py-2 text-right">ERA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(simulation.pitcherLines).map((p) => {
                        const e = era(p, simulation.rules.regulationInnings)
                        return (
                          <tr key={p.playerId} className="border-t border-border">
                            <td className="px-4 py-1.5 font-medium">{p.name} <span className="text-xs text-muted-foreground">({p.side === 'home' ? L.us : L.them})</span></td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{inningsPitched(p.outs)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.battersFaced}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.pitches}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.strikes}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.balls}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.hits}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.runs}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.earnedRuns}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.walks}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.strikeouts}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.hitBatters}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.homeRuns}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{p.wildPitches}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{e === null ? '—' : e.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L.batting}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2">#</th>
                        <th className="px-2 py-2">{L.batting}</th>
                        <th className="px-2 py-2 text-right">PA</th>
                        <th className="px-2 py-2 text-right">AB</th>
                        <th className="px-2 py-2 text-right">H</th>
                        <th className="px-2 py-2 text-right">HR</th>
                        <th className="px-2 py-2 text-right">R</th>
                        <th className="px-2 py-2 text-right">RBI</th>
                        <th className="px-2 py-2 text-right">BB</th>
                        <th className="px-2 py-2 text-right">K</th>
                        <th className="px-2 py-2 text-right">SB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['home', 'opponent'] as const).flatMap((side) =>
                        simulation.lineups[side].map((slot) =>
                          slot.history.map((h) => simulation.batterLines[h.playerId]).filter(Boolean).map((b, i) => (
                            <tr key={`${side}-${slot.order}-${b.playerId}`} className="border-t border-border">
                              <td className="px-4 py-1.5 tabular-nums text-muted-foreground">{i === 0 ? slot.order : ''}</td>
                              <td className="px-2 py-1.5 font-medium">{i > 0 ? '↳ ' : ''}{b.name} <span className="text-xs text-muted-foreground">{slot.position}{side === 'opponent' ? ` · ${L.them}` : ''}</span></td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.plateAppearances}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.atBats}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.hits}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.homeRuns}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.runs}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.rbi}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.walks}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.strikeouts}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{b.stolenBases}</td>
                            </tr>
                          ))
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
