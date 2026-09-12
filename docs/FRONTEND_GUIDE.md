# Front-end guide

Read this before adding or restyling a screen. It keeps every view looking like one product.

## Stack and conventions

- Next.js 15 App Router, all pages are `'use client'` and wrap their content in `<Layout>` from `components/Layout.tsx`.
- Pages live in `app/<route>/page.tsx` and only compose; real UI lives in `components/<Name>View.tsx` (or `<Name>List.tsx` for the older screens).
- Data: `import { supabase } from '@/lib/supabase'` (browser client). Query in `useEffect`, keep `loading` / `error` state, render `<LoadingState>` and `<Alert variant="error">` from the primitives.
- Language: `const { t, language } = useLanguage()` from `contexts/LanguageContext`. `t` is the shared dictionary in `lib/translations.ts`. For labels that only your view needs, keep a local map keyed by `language` (`'en' | 'es'`) inside the component instead of growing the shared file. Spanish is the primary language of the users.
- Icons: `lucide-react` only. Never emoji in UI chrome.
- Styling: Tailwind v4 with the tokens in `app/globals.css` (`bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `bg-accent`, ...). Use the primitives below before writing raw classes.

## Primitives (`components/ui`)

```tsx
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Panel, Modal,
         Input, Select, Textarea, Label, FormField, Checkbox, CheckChip,
         Spinner, LoadingState, Alert, EmptyState, PageHeader, Avatar } from '@/components/ui'
```

- `Button` variants: `primary | secondary | outline | ghost | destructive | success | accent | warning | link`; sizes `xs | sm | md | lg | icon | icon-sm`; `loading` prop shows a spinner and disables.
- `Badge` variants: `default | primary | success | warning | danger | info | purple | outline | solid | dark`.
- `Card` (white, rounded-xl, border, shadow-sm) with `CardHeader/CardTitle/CardContent/CardFooter`; `Panel` is the tinted inline-form container.
- `Modal` props: `onClose`, `title`, `description`, `size` (`sm | md | lg | xl | full`), `tall` (95vh), `flush`, `footer`, `locked`, `closeOnBackdrop`.
- Forms: wrap each control in `FormField label required hint`. Controls are `Input`, `Select`, `Textarea`, `Checkbox`; `CheckChip` for multi-select chips.
- `PageHeader title count description actions` at the top of every page. `EmptyState icon title description action` for empty lists.
- `Avatar src alt initials size rounded` handles broken images.

## Layout patterns

- Page = `PageHeader` + optional filters row + content. Vertical rhythm `space-y-6`.
- Stat tiles: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, each a `Card` with a small muted label, a big `tabular-nums` value, and an optional trend line.
- Tables: wrap in `<div className="overflow-x-auto rounded-xl border border-border bg-card">`, `<table className="w-full text-sm">`, header `bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground`, rows `border-t border-border hover:bg-slate-50/60`, numeric cells `text-right tabular-nums`.
- Lists of people: `Avatar` + name + muted secondary line, actions on the right as `size="sm"` buttons.
- Never a horizontal page scroll: wide content scrolls inside its own container.
- Mobile first: stack with `flex-col`, then `sm:flex-row`. The sidebar collapses under `lg`.

## Data model (Supabase, schema `public`)

| Table | Columns used by the UI |
| --- | --- |
| `teams` | id, name, city, logo_url, manager, coach, founded_year, stadium |
| `players` | id, first_name, last_name, jersey_number, positions `text[]` (labels like `Pitcher (P)` / `Lanzador (P)`), handedness (`Righty/Lefty/Switch`), team_id, photo_url, date_of_birth, is_active, batting_hand, throwing_hand, height_inches, weight_lbs, contact_number, emergency_number, emergency_contact_name |
| `games` | id, opponent, game_date, game_time, stadium, weather_conditions, our_score, opponent_score, innings_played, game_status (`scheduled/in_progress/completed/postponed/cancelled`), team_id, lineup_template_id, opponent_lineup_template_id, batting_first (`home/opponent`) |
| `at_bats` | id, game_id, player_id, inning, at_bat_number, result, rbi, runs_scored, stolen_bases, team_side (`home` = our team, `opponent`), notation, field_area, field_zone, hit_distance, hit_angle, base_runners, base_runner_outs, out_type, created_at |
| `lineup_templates` | id, team_id (unique), name |
| `lineup_template_players` | id, template_id, player_id, batting_order (1-10), position (`P C 1B 2B 3B SS LF CF RF DH`), batting_for |

`at_bats.result` values: `single double triple home_run walk strikeout ground_out fly_out line_out pop_out error hit_by_pitch sacrifice_fly sacrifice_bunt`.
Batting math: hits = single+double+triple+home_run; at-bats exclude walk, hit_by_pitch, sacrifice_fly, sacrifice_bunt; AVG = H/AB; OBP = (H+BB+HBP)/(AB+BB+HBP+SF); SLG = (1B+2·2B+3·3B+4·HR)/AB.

"Our team" is the team referenced by `games.team_id` (the Dodgers). Opponent rosters exist as teams with `city = 'Opponent'`.

## Relationship embeds

PostgREST embeds work through foreign keys: `players ( ... )` from `at_bats`, `lineup_template_players`, and `teams`; `teams ( ... )` from `players` and `games`. `lineup_template_players.batting_for` is intentionally not a foreign key.
