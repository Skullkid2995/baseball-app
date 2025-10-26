-- Baseball App Database Schema
-- This file contains the SQL schema for creating tables and relationships

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    manager VARCHAR(100),
    coach VARCHAR(100),
    founded_year INTEGER,
    stadium VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    positions TEXT[] NOT NULL, -- Array of positions
    handedness VARCHAR(10) NOT NULL CHECK (handedness IN ('Righty', 'Lefty', 'Switch')),
    contact_number VARCHAR(20),
    emergency_number VARCHAR(20),
    emergency_contact_name VARCHAR(100),
    jersey_number INTEGER,
    height_inches INTEGER,
    weight_lbs INTEGER,
    batting_hand VARCHAR(1) CHECK (batting_hand IN ('L', 'R', 'S')),
    throwing_hand VARCHAR(1) CHECK (throwing_hand IN ('L', 'R')),
    debut_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    home_team_id UUID NOT NULL REFERENCES teams(id),
    away_team_id UUID NOT NULL REFERENCES teams(id),
    game_date DATE NOT NULL,
    game_time TIME,
    stadium VARCHAR(100),
    weather_conditions VARCHAR(100),
    attendance INTEGER,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    innings_played INTEGER DEFAULT 9,
    game_status VARCHAR(20) DEFAULT 'scheduled' CHECK (game_status IN ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

-- Player statistics table
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    at_bats INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    runs INTEGER DEFAULT 0,
    rbi INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    innings_pitched DECIMAL(4,1) DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    strikeouts_pitched INTEGER DEFAULT 0,
    walks_pitched INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game ON player_stats(game_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
