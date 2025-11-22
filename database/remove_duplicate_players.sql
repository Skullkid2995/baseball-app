-- Script to find and remove duplicate players
-- Run this in your Supabase SQL Editor

-- Step 1: Find all duplicate players (same name and DOB)
SELECT 
  first_name,
  last_name,
  date_of_birth,
  COUNT(*) as duplicate_count,
  array_agg(id::text) as player_ids,
  array_agg(team_id::text) as team_ids
FROM players
GROUP BY first_name, last_name, date_of_birth
HAVING COUNT(*) > 1;

-- Step 2: Find specific duplicates for Jesus Contreras with all details
SELECT 
  id,
  first_name,
  last_name,
  date_of_birth,
  team_id,
  created_at,
  CASE 
    WHEN team_id IS NULL THEN 'No Team'
    ELSE 'Has Team'
  END as team_status
FROM players
WHERE first_name = 'Jesus' AND last_name = 'Contreras'
ORDER BY created_at;

-- Step 3: Delete the duplicate (choose one of these options):

-- Option A: Delete the one WITHOUT a team (keeps the one with a team)
DELETE FROM players 
WHERE id IN (
  SELECT id FROM players 
  WHERE first_name = 'Jesus' 
    AND last_name = 'Contreras'
    AND team_id IS NULL
  LIMIT 1
);

-- Option B: Delete the OLDEST duplicate (keeps the most recent one)
-- DELETE FROM players 
-- WHERE id = (
--   SELECT id FROM players 
--   WHERE first_name = 'Jesus' AND last_name = 'Contreras'
--   ORDER BY created_at ASC
--   LIMIT 1
-- );

-- Option C: Delete a specific duplicate by ID (replace with actual UUID from Step 2)
-- First run Step 2 to get the IDs, then use one of them:
-- DELETE FROM players WHERE id = 'paste-actual-uuid-here';

