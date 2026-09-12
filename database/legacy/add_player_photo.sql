-- Add photo_url field to players table
-- Run this in your Supabase SQL Editor

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN players.photo_url IS 'URL to player photo stored in Supabase Storage';

