-- Sample data for Baseball App
-- Insert some teams, players, and games for testing

-- Insert teams
INSERT INTO teams (name, city, league, division, founded_year, stadium) VALUES
('Yankees', 'New York', 'American League', 'East', 1901, 'Yankee Stadium'),
('Red Sox', 'Boston', 'American League', 'East', 1901, 'Fenway Park'),
('Dodgers', 'Los Angeles', 'National League', 'West', 1883, 'Dodger Stadium'),
('Giants', 'San Francisco', 'National League', 'West', 1883, 'Oracle Park'),
('Cubs', 'Chicago', 'National League', 'Central', 1876, 'Wrigley Field'),
('Cardinals', 'St. Louis', 'National League', 'Central', 1882, 'Busch Stadium');

-- Insert players
INSERT INTO players (first_name, last_name, position, team_id, jersey_number, height_inches, weight_lbs, batting_hand, throwing_hand, birth_date, debut_date, salary, is_active) VALUES
('Aaron', 'Judge', 'RF', (SELECT id FROM teams WHERE name = 'Yankees'), 99, 79, 282, 'R', 'R', '1992-04-26', '2016-08-13', 40000000.00, true),
('Mookie', 'Betts', 'RF', (SELECT id FROM teams WHERE name = 'Dodgers'), 50, 69, 180, 'R', 'R', '1992-10-07', '2014-06-29', 36500000.00, true),
('Mike', 'Trout', 'CF', (SELECT id FROM teams WHERE name = 'Angels'), 27, 74, 235, 'R', 'R', '1991-08-07', '2011-07-08', 42650000.00, true),
('Ronald', 'Acuña Jr.', 'RF', (SELECT id FROM teams WHERE name = 'Braves'), 13, 72, 205, 'R', 'R', '1997-12-18', '2018-04-25', 17000000.00, true),
('Vladimir', 'Guerrero Jr.', '1B', (SELECT id FROM teams WHERE name = 'Blue Jays'), 27, 74, 250, 'R', 'R', '1999-03-16', '2019-04-26', 14500000.00, true);

-- Insert games
INSERT INTO games (home_team_id, away_team_id, game_date, game_time, stadium, weather_conditions, attendance, home_score, away_score, innings_played, game_status) VALUES
((SELECT id FROM teams WHERE name = 'Yankees'), (SELECT id FROM teams WHERE name = 'Red Sox'), '2024-04-15', '19:05:00', 'Yankee Stadium', 'Clear, 72°F', 47000, 5, 3, 9, 'completed'),
((SELECT id FROM teams WHERE name = 'Dodgers'), (SELECT id FROM teams WHERE name = 'Giants'), '2024-04-16', '19:10:00', 'Dodger Stadium', 'Partly Cloudy, 68°F', 52000, 7, 2, 9, 'completed'),
((SELECT id FROM teams WHERE name = 'Cubs'), (SELECT id FROM teams WHERE name = 'Cardinals'), '2024-04-17', '14:20:00', 'Wrigley Field', 'Sunny, 75°F', 41000, 4, 6, 9, 'completed');

-- Insert player statistics for the games
INSERT INTO player_stats (player_id, game_id, at_bats, hits, runs, rbi, home_runs, walks, strikeouts, stolen_bases, errors) VALUES
((SELECT id FROM players WHERE first_name = 'Aaron' AND last_name = 'Judge'), (SELECT id FROM games WHERE game_date = '2024-04-15'), 4, 2, 1, 2, 1, 0, 1, 0, 0),
((SELECT id FROM players WHERE first_name = 'Mookie' AND last_name = 'Betts'), (SELECT id FROM games WHERE game_date = '2024-04-16'), 4, 3, 2, 3, 2, 1, 0, 1, 0);
