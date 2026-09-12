-- Simplified Games table for single team offensive tracking
-- Run this in your Supabase SQL Editor

-- Drop existing games table if it exists
DROP TABLE IF EXISTS games CASCADE;

-- Create simplified games table
CREATE TABLE games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    opponent VARCHAR(100) NOT NULL,
    game_date DATE NOT NULL,
    game_time TIME,
    stadium VARCHAR(100),
    weather_conditions VARCHAR(100),
    our_score INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    innings_played INTEGER DEFAULT 0,
    game_status VARCHAR(20) DEFAULT 'scheduled' CHECK (game_status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create at_bats table for offensive tracking
CREATE TABLE at_bats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    inning INTEGER NOT NULL,
    at_bat_number INTEGER NOT NULL,
    result VARCHAR(50) NOT NULL CHECK (result IN ('single', 'double', 'triple', 'home_run', 'walk', 'strikeout', 'ground_out', 'fly_out', 'line_out', 'pop_out', 'error', 'hit_by_pitch', 'sacrifice_fly', 'sacrifice_bunt')),
    rbi INTEGER DEFAULT 0,
    runs_scored INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    base_runners JSONB DEFAULT '{"first": false, "second": false, "third": false, "home": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(game_status);
CREATE INDEX IF NOT EXISTS idx_at_bats_game ON at_bats(game_id);
CREATE INDEX IF NOT EXISTS idx_at_bats_player ON at_bats(player_id);
CREATE INDEX IF NOT EXISTS idx_at_bats_inning ON at_bats(inning);

-- Add comment to explain the base_runners field
COMMENT ON COLUMN at_bats.base_runners IS 'JSON object storing base runner positions: {first: boolean, second: boolean, third: boolean, home: boolean}';

-- Create updated_at trigger for games
CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
