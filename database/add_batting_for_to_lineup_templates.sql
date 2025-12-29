-- Add batting_for field to lineup_template_players table
-- This field stores which player the Designated Hitter (DH) is batting for
-- Run this in your Supabase SQL Editor

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lineup_template_players' AND column_name = 'batting_for'
    ) THEN
        ALTER TABLE lineup_template_players 
        ADD COLUMN batting_for UUID REFERENCES players(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN lineup_template_players.batting_for IS 
        'Player ID that the Designated Hitter is batting for (only used when position is DH). This is typically a pitcher who does not bat.';
    END IF;
END $$;

