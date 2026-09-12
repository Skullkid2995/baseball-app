-- Views for Baseball League Management System
-- NOTE: Adjust table/column names if they differ in your schema.
-- Safe to re-run: each view is dropped if exists first.

-- 1) League Overview View
DROP VIEW IF EXISTS public.v_league_overview;
CREATE OR REPLACE VIEW public.v_league_overview AS
SELECT 
  l.id              AS league_id,
  l.name            AS league_name,
  s.id              AS season_id,
  s.name            AS season_name,
  COALESCE(t.total_teams, 0) AS total_teams
FROM public.leagues l
LEFT JOIN public.seasons s
  ON s.league_id = l.id
LEFT JOIN (
  SELECT se.id AS season_id, COUNT(DISTINCT tm.id) AS total_teams
  FROM public.seasons se
  LEFT JOIN public.teams tm ON tm.season_id = se.id
  GROUP BY se.id
) t ON t.season_id = s.id;

-- 2) Team Roster View
DROP VIEW IF EXISTS public.v_team_roster;
CREATE OR REPLACE VIEW public.v_team_roster AS
SELECT 
  tm.id            AS team_id,
  tm.name          AS team_name,
  p.id             AS player_id,
  COALESCE(p.full_name, CONCAT(p.first_name, ' ', p.last_name)) AS player_name,
  p.dob,
  COALESCE(p.is_injured, false)       AS is_injured,
  COALESCE(p.is_reinforcement, false) AS is_reinforcement,
  p.field_position
FROM public.teams tm
INNER JOIN public.players p ON p.team_id = tm.id;

-- 3) Game Schedule View
DROP VIEW IF EXISTS public.v_game_schedule;
CREATE OR REPLACE VIEW public.v_game_schedule AS
SELECT 
  g.id          AS game_id,
  g.season_id,
  g.game_date,
  g.game_time,
  h.name        AS home_team_name,
  a.name        AS away_team_name,
  g.status
FROM public.games g
LEFT JOIN public.teams h ON h.id = g.home_team_id
LEFT JOIN public.teams a ON a.id = g.away_team_id;

-- 4) Box Score View
DROP VIEW IF EXISTS public.v_box_score;
CREATE OR REPLACE VIEW public.v_box_score AS
SELECT 
  gps.game_id,
  tm.id         AS team_id,
  p.id          AS player_id,
  COALESCE(p.full_name, CONCAT(p.first_name, ' ', p.last_name)) AS player_name,
  COALESCE(gps.at_bats, 0)     AS at_bats,
  COALESCE(gps.hits, 0)        AS hits,
  COALESCE(gps.runs, 0)        AS runs,
  COALESCE(gps.rbis, 0)        AS rbis,
  COALESCE(gps.strikeouts, 0)  AS strikeouts
FROM public.game_player_stats gps
LEFT JOIN public.players p ON p.id = gps.player_id
LEFT JOIN public.teams tm ON tm.id = gps.team_id;

-- 5) Batting Order View
DROP VIEW IF EXISTS public.v_batting_order;
CREATE OR REPLACE VIEW public.v_batting_order AS
SELECT 
  bo.game_id,
  bo.team_id,
  bo.player_id,
  COALESCE(p.full_name, CONCAT(p.first_name, ' ', p.last_name)) AS player_name,
  bo.batting_position,
  bo.field_position
FROM public.batting_order bo
LEFT JOIN public.players p ON p.id = bo.player_id;

-- 6) Pitch-by-Pitch View
DROP VIEW IF EXISTS public.v_pitch_by_pitch;
CREATE OR REPLACE VIEW public.v_pitch_by_pitch AS
SELECT 
  pe.game_id,
  pe.inning_number,
  pe.is_top_inning,
  COALESCE(b.full_name, CONCAT(b.first_name, ' ', b.last_name)) AS batter_name,
  COALESCE(pi.full_name, CONCAT(pi.first_name, ' ', pi.last_name)) AS pitcher_name,
  pe.pitch_result,
  pe.pitch_type,
  pe.outs,
  pe.count_balls,
  pe.count_strikes,
  COALESCE(r1.full_name, CONCAT(r1.first_name, ' ', r1.last_name)) AS runner_on_first_name,
  COALESCE(r2.full_name, CONCAT(r2.first_name, ' ', r2.last_name)) AS runner_on_second_name,
  COALESCE(r3.full_name, CONCAT(r3.first_name, ' ', r3.last_name)) AS runner_on_third_name,
  pe.field_play_description
FROM public.pitch_events pe
LEFT JOIN public.players b  ON b.id  = pe.batter_id
LEFT JOIN public.players pi ON pi.id = pe.pitcher_id
LEFT JOIN public.players r1 ON r1.id = pe.runner_on_first_id
LEFT JOIN public.players r2 ON r2.id = pe.runner_on_second_id
LEFT JOIN public.players r3 ON r3.id = pe.runner_on_third_id;

-- 7) Runner Advancements View
DROP VIEW IF EXISTS public.v_runner_advancements;
CREATE OR REPLACE VIEW public.v_runner_advancements AS
SELECT 
  ra.game_id,
  ra.pitch_event_id,
  ra.player_id,
  COALESCE(p.full_name, CONCAT(p.first_name, ' ', p.last_name)) AS player_name,
  COALESCE(ra.reached_first,  false) AS reached_first,
  COALESCE(ra.reached_second, false) AS reached_second,
  COALESCE(ra.reached_third,  false) AS reached_third,
  COALESCE(ra.scored,         false) AS scored,
  COALESCE(ra.is_out,         false) AS is_out,
  ra.notes
FROM public.runner_advancements ra
LEFT JOIN public.players p ON p.id = ra.player_id;

-- 8) Team Invoices View
DROP VIEW IF EXISTS public.v_team_invoices;
CREATE OR REPLACE VIEW public.v_team_invoices AS
SELECT 
  ti.id      AS invoice_id,
  ti.team_id,
  tm.name    AS team_name,
  tm.season_id,
  s.league_id,
  ti.invoice_type,
  ti.amount,
  COALESCE(ti.amount_paid, 0) AS amount_paid,
  ti.status,
  ti.created_at
FROM public.team_invoices ti
LEFT JOIN public.teams tm ON tm.id = ti.team_id
LEFT JOIN public.seasons s ON s.id = tm.season_id;

-- 9) Roster Change Requests View
DROP VIEW IF EXISTS public.v_roster_change_requests;
CREATE OR REPLACE VIEW public.v_roster_change_requests AS
SELECT 
  rcr.id      AS request_id,
  rcr.team_id,
  tm.name     AS team_name,
  rcr.player_id,
  COALESCE(p.full_name, CONCAT(p.first_name, ' ', p.last_name)) AS player_name,
  tm.season_id,
  s.league_id,
  rcr.status,
  rcr.created_at,
  rcr.reviewed_by
FROM public.roster_change_requests rcr
LEFT JOIN public.players p ON p.id = rcr.player_id
LEFT JOIN public.teams tm   ON tm.id = rcr.team_id
LEFT JOIN public.seasons s  ON s.id = tm.season_id;
