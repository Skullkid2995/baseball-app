-- Remove League and Division columns from teams table
-- Run this in your Supabase SQL Editor

-- First, drop the constraints
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_league_check;

-- Remove the columns
ALTER TABLE teams DROP COLUMN IF EXISTS league;
ALTER TABLE teams DROP COLUMN IF EXISTS division;

