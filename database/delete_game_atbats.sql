-- Delete all at-bats data for a specific game
-- Replace 'GAME_ID_HERE' with the actual game ID you want to clear

-- First, let's see what games exist
SELECT id, opponent, game_date, game_status FROM games ORDER BY created_at DESC;

-- Delete all at-bats for a specific game (replace with actual game ID)
-- DELETE FROM at_bats WHERE game_id = 'GAME_ID_HERE';

-- To delete all at-bats for all games (use with caution!)
-- DELETE FROM at_bats;

