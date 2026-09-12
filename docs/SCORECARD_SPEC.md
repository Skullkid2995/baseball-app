# Scorecard spec: Classic and Digital modes

Status: draft for review, 2026-09-12. Nothing here is built yet except where marked *exists*.

## Purpose

The scorebook is the source of every statistic the manager uses to decide who pitches, who
hits, and where our hitters tend to put the ball against a given pitcher. Every plate
appearance must therefore record **who pitched, what happened, and where the ball landed on
contact**. Pitch-by-pitch location in the strike zone is explicitly out of scope; balls and
strikes are optional tally marks.

## Two ways to score the same data

Both modes write the same rows. Switching mode never loses data.

| | Classic / Clásico | Digital |
| --- | --- | --- |
| Feel | Paper scorecard: a grid of boxes with a mini diamond; you write with a stylus or finger | Buttons and pick-lists (today's scorebook, improved) |
| Runner advance | Tap a base path: it darkens in pencil style | Tap base buttons |
| Outs | Tap the corner marker: draws a circled 1, 2 or 3 | Tap "Out" and pick the type |
| Play notation ("4-3", "K", "BB", "E6", "F8") | Free ink in the box, plus a small confirm pick-list at the end of the plate appearance | Pick-list |
| Ball in play | Draw the ball's line from home plate across the mini diamond: ink stays, the end point is saved as the landing coordinate | Tap the field |
| Balls / strikes / fouls | Optional dots in the box corners (tap to add) | Optional counter (*exists*) |
| Corrections | Eraser and undo per box; the data updates immediately | Edit the plate appearance (*exists*) |

The **hybrid rule**: ink is kept for the visual record; anything that feeds statistics is
also a tap or a confirm. We do not recognize handwriting.

## Card layout (Classic)

- One sheet per team, flip between them (*exists* as "Voltear hoja").
- Rows: the 9 (or 10 with DH) batting slots, with substitutions appended under the slot they replace.
- Columns: innings 1 to 9 plus extra innings as needed; totals AB / R / H / RBI on the right.
- Pitcher box at the top of each inning column: who is pitching for the other team. A pitching change mid-inning adds a second name in the same box.
- Each box: mini diamond, notation area, out marker in the lower-right corner, balls/strikes dots in the upper-left.
- Zoomed box: tapping a box on a phone opens it enlarged for writing; on a tablet the grid is written directly.
- Pen input uses Pointer Events. When a stylus is detected (`pointerType === 'pen'`) touch input is ignored while writing so the palm can rest on the screen.

## Data model changes (additive; see `database/migrations/2026-09-12_scorecard_v2.sql`)

`at_bats` (one row per plate appearance, *exists*) gains:

| Column | Meaning |
| --- | --- |
| `pitcher_id` | Player on the mound for this plate appearance (from the opposing lineup's P slot or the pitching-change log) |
| `hit_x`, `hit_y` | Landing coordinate as a percentage of the field image (0 to 100). The canvas already computes this; it was never stored |
| `trajectory` | ground, line, fly, popup, bunt |
| `contact_quality` | soft, medium, hard (optional) |
| `balls`, `strikes`, `fouls`, `pitches` | Optional tallies from the dots/counter |
| `out_number` | 1, 2 or 3 when this plate appearance produced the inning's Nth out |
| `batting_slot` | 1 to 10, so substitutes stay under the slot they replaced |
| `entered_via` | classic or digital |

New tables:

- `scorecard_ink`: the pencil strokes of one box (game, side, slot, inning) as a compact JSON list of paths. Purely visual; can be deleted without losing statistics.
- `game_pitchers`: pitching changes per side, in order, with the inning and plate appearance where each pitcher entered. The first row per side comes from the lineup automatically.
- `game_substitutions` (phase 2): pinch hitters, pinch runners and defensive changes.

Everything the analytics need comes from `at_bats` joined to `players` twice (batter, pitcher).

## Analytics unlocked

- Spray chart per hitter from `hit_x`/`hit_y`, filterable by pitcher, pitcher handedness, count, and game.
- Batter vs pitcher history: results and landing spots for every meeting.
- Pitcher tendencies: outcomes and hard-contact rate by inning and by times through the order.
- Everything the Statistics page shows today keeps working; the new columns only add filters.

## Phases

1. Data model migration and pitcher on record (Digital mode writes `pitcher_id`, `hit_x`/`hit_y`, `trajectory`, `batting_slot`). Small, unlocks the spray chart immediately.
2. Classic sheet: grid, box zoom, base paths and out marker as taps, notation ink saved per box, ball-line gesture that stores the landing point, confirm pick-list at the end of the plate appearance.
3. Pitching changes and substitutions.
4. Spray chart and batter-vs-pitcher views on the Statistics page.

## Assumptions to confirm

- Scoring device: a tablet in the dugout with finger or stylus; phone supported through the zoomed box.
- Opponent pitchers are named through the opponent lineup (the quick-entry form already creates them); unknown pitchers can be entered as "P #N".
- Corrections take effect immediately; no end-of-inning review step.
- Substitutions ship in phase 3, not in the first Classic release.
