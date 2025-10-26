-- Add base_runners field to at_bats table
-- Run this in your Supabase SQL Editor

-- Add base_runners column to store base runner positions
ALTER TABLE at_bats 
ADD COLUMN base_runners JSONB DEFAULT '{"first": false, "second": false, "third": false, "home": false}';

-- Add comment to explain the field
COMMENT ON COLUMN at_bats.base_runners IS 'JSON object storing base runner positions: {first: boolean, second: boolean, third: boolean, home: boolean}';

