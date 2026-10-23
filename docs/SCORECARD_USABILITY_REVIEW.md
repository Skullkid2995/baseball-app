# Live scorecard usability review

Reviewed October 8, 2026 for a scorer who knows baseball but is not comfortable with software, using a 390 × 844 phone viewport.

## Fixes made

| Problem | Result |
| --- | --- |
| Writing could be accepted automatically after a pause. | Both scorecard views require explicit result confirmation. |
| Typing `6-4-3` could submit at its valid `6-4` prefix. | Typed codes remain drafts until Confirm code or Enter. |
| Paper mode allowed saving before every runner was reviewed. | Each runner needs an explicit destination or stay decision, except when the third out cancels runs. |
| Runner updates needed clearer feedback. | Visible diamonds accept lines between bases, show the resulting destination, and offer an explicit stay confirmation. Restored drawing as the default at the user's request. |
| Drawing surfaces interfered with scrolling. | Runner diamonds have a drawing/scroll toggle and remain visible in both modes; canceled strokes are discarded. |
| Save appeared and disappeared, and draft storage looked like a completed play. | Save stays visible with a reason when unavailable; draft storage explicitly says the score is not updated. |
| Old base marks could save a home run with zero runs or a double at first. | Confirmed results enforce their minimum base while retaining valid further advances and advancing outs. |
| A tag third out hid other runners before their preceding runs could be reviewed. | Those runners remain available, with timing guidance. |
| Failed scorecard loads looked like a new, empty game. | Scoring pauses with a connection message and retry button. Opening a scorecard no longer writes score totals to the database. |
| A partially saved at-bat could be restarted or edited during retry. | Retry uses the saved batter ID, preserves the original runners, and locks editing, pitcher changes, and scorebook navigation while finishing that play. |
| Startup could wait indefinitely for authentication; the deployed site returned a middleware timeout. | Protected checks have an eight-second deadline and fail closed to a reachable bilingual retry page. Public recovery routes do not wait for authentication. |
| An email containing SQL pattern characters could match another account. | Access lookup escapes literal email wildcard characters. |

## Verification

- 181 automated tests passed, including new confirmed-base, runner-review, route protection, timeout, and access-lookup cases.
- TypeScript and the optimized Next.js build passed. Existing lint warnings remain; changed-file lint has no errors.
- Browser walkthrough used real editor components and styles with isolated draft, training, and save services; no real game scores were changed.
- Phone-size checks covered a single with one runner advancing and one scoring, required review before save, a tag third out with a preceding run, a simulated failed save and successful retry, typed `6-4-3`, and Spanish guided mode with an inning-ending strikeout.

## Remaining reliability work

The database still saves the batter, runner history, runner states, and totals through separate requests. The UI retry improvements do not provide transactional durability after a full reload or lost server response. Between-pitch runner events also need durable idempotency. A database migration and transactional scoring RPC should commit a complete play once, with server-side validation and a unique play identity. Existing records must be checked for duplicates before adding uniqueness constraints.

After deployment, the production URL reaches the account-service retry page rather than a 504. A read-only health request to the configured Supabase service failed with DNS `ENOTFOUND`. The public production JavaScript bundle confirms that it uses the same hostname, `uzbupbtrmbmmmkztmrtl.supabase.co`. The reason the project hostname is unavailable (for example, its project lifecycle state) was not verified in the Supabase dashboard. Restore or reconnect the project using `RECONNECT_SUPABASE.md`; bounded retry handling cannot repair an unavailable backend service.

Authentication and real database writes were not exercised through a signed-in production game. A physical phone check with the intended scorer is still useful for glare, grip, and preferred text size.

## Restore follow-up — October 8, 2026

The owner initiated restoration of the existing Supabase project. The dashboard subsequently reported Healthy. Authentication health returned HTTP 200, and a zero-row request to `public.games` returned HTTP 200 with the existing app key. The production app reaches its normal Google sign-in page. No connection settings or game records were changed. A signed-in scoring check remains to be done by the user.

## MLB practice follow-up — October 18, 2026

Created separate Rays and Guardians practice teams in `MLB · Pruebas de anotación`, with a game for October 19 at 17:08 Tijuana time (20:08 ET). Game ID: `adb12cab-e37a-4254-91e6-09d3ef9fd92a`. Both batting orders follow MLB's projected Game 6 preview and must be checked against confirmed lineups before first pitch. Each has nine batting slots with its DH linked to a separate pitcher; Cleveland's Slade Cecconi is provisional. Roster metadata and jersey zeroes are setup placeholders, not verified MLB player profiles.

Preparation exposed a missing `team_id` projection that made the wizard fall back to the largest roster, Dodgers. The wizard now honors the assigned team and reports an unavailable assigned team instead of silently choosing another one. Visitor/home labels now agree with the stored first-batting side. Game-list dates are parsed as local calendar dates so October 19 does not display as October 18 in Tijuana.

Verified both regular batting editors as super admin. In the shared scorecard, the same account submitted a test single as Cleveland and requested correction as Tampa Bay. That audit entry is marked as a test and does not change score, outs, runners, or the opening batter. Both scorecards remain 0–0. The existing 181 tests and TypeScript passed; production builds succeeded. The two scorecard modes keep separate scoring state.

User feedback format saved in the practice league notes: inning / play / what I tried / what happened / what I expected / improvement.

## Single-scorer practice and MLB context — October 18, 2026

At the owner's request, the two-manager entry point was removed. Existing `/live/[gameId]/faceoff` links redirect to the normal scorebook for that game; the previous test audit is retained without being merged into official game statistics. The normal team switch allows this super admin to open either team's nine-row sheet. Paper/guided selection remains inside the scorebook. Following the owner's layout correction, language controls appear only in the app's top-right header; duplicate controls were removed from the scorebook and active editor.

Both editor modes now show game AVG and season AVG under the batter. A tap or deliberate vertical drag opens season, career, postseason, and career batter-versus-pitcher context from authenticated, server-fetched MLB Stats API requests. Players are linked by curated official ID, full name and MLB team; local namesakes are not linked. Combined totals for traded players are not counted twice. H/AB and BB/K per PA show their denominators; zero-at-bat averages and missing responses remain unavailable. Retrieval time and up-to-15-minute caching are disclosed. Historical percentages are not predicted odds. MLB spray data is shown as five directional zones, while recorded app hits use their saved coordinates.

Official MLB CDN portraits and team logos identify the two practice rosters and active pitcher. Opening an already-open paper cell focuses and scrolls to its editor without replacing the draft. Content width is constrained and the bottom navigation reserves space, including the phone safe area.

Every ball-in-play result now requires a field direction before runner review or saving. Handwriting that already contains a valid trajectory satisfies this step; other plays use a tap/drag field that draws a home-to-ball line. Walks, strikeouts, hit-by-pitch and interference are exempt. Dedicated direction coordinates are stored separately from base-path ink, preventing an infield landing near a base from accidentally advancing the batter. Confirmed directions survive paper draft reloads and are included in saved landing statistics.

Validation: 196 unit/API tests passed and TypeScript passed. Browser checks used the real signed-in game for live MLB retrieval, both team editors, loaded official images, repeat-cell scrolling, and a 390px phone viewport with no page-wide overflow. Isolated fixture checks verified blocked saves before direction, automatic runner focus after confirmation, language changes preserving the selected result/direction, and a saved payload containing the chosen coordinates. No practice at-bat was added to the live game during these checks.

## Complete MLB rosters, photos, bench and bullpen — October 18, 2026

Fetched the official active rosters for Cleveland (114) and Tampa Bay (139) dated October 19 and the MLB people profiles for all 52 players. Updated the 20 practice players in place and added 32 roster members, with official jersey numbers, birth dates, batting/throwing hands, primary positions, height, weight, debut dates and portrait URLs. Contacts were not fabricated. Current starting batting slots, DH links, scores and pitching appearances were retained. Petey Halpin's official jersey number is zero; the player directory now displays, searches and sorts valid zeroes correctly. The roster is an official active-roster snapshot, not confirmation of a final postseason lineup or tomorrow's starter.

Portraits now appear in the mound panel, pitcher list, replacement player lists, preparation lineup and mobile lineup rows. Replacement choices use keyboard-accessible radio inputs with player photos. Language controls remain only in the top-right app header.

The owner applied `2026-10-18_game_reserves.sql` in Supabase. The game stores bench/bullpen selections separately for each side in `games.roster_reserves`, independently of reusable batting templates. Preparation offers role selection for every unused roster player, excluding the starting lineup and the DH-linked starting pitcher. Empty selections are deliberate; older games without a selection retain their full-roster behavior. Writes use optimistic concurrency to preserve the other team's selection. Pinch hitters/runners and defensive replacements use the selected unused bench; pitcher changes use the selected unused bullpen plus the current pitcher for context.

Initialized this practice game with Tampa Bay's five bench players and eleven bullpen pitchers, and Cleveland's four bench players and twelve bullpen pitchers. `scripts/sync-mlb-practice-profiles.mjs` and `scripts/initialize-mlb-practice-reserves.mjs` are narrowly scoped, dry-run by default, and require `--apply` for writes. Their local audit snapshots are excluded from deployment and Git under `tmp/`.

Validation: 201 tests passed and TypeScript passed. Signed-in browser checks verified twelve photographed Tampa Bay pitcher entries (eleven available plus the current pitcher), the five selected bench players, the complete nine-player replacement list, and correct official jersey numbers. No actual substitution or scoring play was submitted during verification.

Pitching changes default to a Pitchers list and provide a separate Position players option, each with its own search and official portraits. The latter offers active fielders and the selected bench, excluding removed/previously used pitchers, and reminds the scorer to review defensive positions and DH implications. Verified the default selected filter and all fourteen available Tampa Bay position players. An isolated preparation fixture verified selecting bench/bullpen roles and excluding a player updates the parent draft while starters remain excluded, without writing a live lineup.

## World Series replacement — October 23, 2026

At the owner's request, replaced the unused October 19 Cleveland practice game with Brewers–Rays World Series Game 1. Confirmed the old game had zero at-bats and a 0–0 score, backed up its rows locally, then deleted only that game and its isolated faceoff room after verifying its replacement. The unrelated Dodgers–Union game and existing Cleveland roster were retained.

MLB's schedule lists Game 1 in Milwaukee on October 23 at 17:00 America/Tijuana, followed by Games 2–7 on October 24, 26, 27, 28, 30 and 31 at 17:00. The latter six were created as scheduled with both lineup-template links null; Games 5–7 are explicitly marked as conditional. Home/visitor teams and venues follow the official schedule.

New Game 1 ID: `b07ad12b-8afe-4e3e-a163-d4ab422d2dd9`. Ready for scoring at 0–0 with Nick Martinez for Tampa Bay and Jacob Misiorowski for Milwaukee. Official boxscore batting orders were empty when checked, so the starting nines use MLB's projected Game 1 preview and are labeled projected in the app. Both DH slots reference their own starting pitcher. Milwaukee has four bench players and twelve bullpen pitchers; Tampa Bay has five and eleven.

Imported Milwaukee's 26 active players and refreshed Tampa Bay's October 23 roster, including Garrett Cleavinger in place of Brody Hopkins. Added official photos, jersey numbers, birth dates, handedness, height, weight and debut dates, plus the Brewers team logo and MLB statistics identities. Prior roster members are retained as inactive rather than deleted. Lineup preparation and reserve selection now exclude inactive players while preserving a recorded current pitcher for historical context.

The narrowly scoped `scripts/prepare-2026-world-series.mjs` defaults to dry-run, requires `--apply` for writes, validates official fixtures and lineup identities, refuses to remove a scored old game, and keeps local backups under ignored `tmp/`. Source endpoints: MLB Stats API schedule, game boxscore, active rosters and player profiles; projected order: `https://www.mlb.com/brewers/news/rays-brewers-world-series-game-1-starting-lineups-and-pitching-matchup`.

Verification: 202 tests and TypeScript passed. Database readback confirmed both starting nines, DH pitcher links, reserve counts, 0–0, and null future lineup links. Signed-in production review confirmed Tampa Bay bats first with Yandy Díaz against Jacob Misiorowski; no play was recorded during verification.
