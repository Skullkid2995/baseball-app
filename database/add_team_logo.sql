-- Add logo_url field to teams table
-- Run this in your Supabase SQL Editor

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

