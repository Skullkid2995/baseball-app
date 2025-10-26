-- Add field location tracking fields to at_bats table
-- Run this in your Supabase SQL Editor

-- Add field location fields
ALTER TABLE at_bats 
ADD COLUMN field_area VARCHAR(50) DEFAULT '',
ADD COLUMN field_zone VARCHAR(50) DEFAULT '',
ADD COLUMN hit_distance VARCHAR(20) DEFAULT '',
ADD COLUMN hit_angle VARCHAR(20) DEFAULT '';

-- Add comments to explain the fields
COMMENT ON COLUMN at_bats.field_area IS 'General field area where ball landed (LEFT_FIELD, CENTER_FIELD, INFIELD, etc.)';
COMMENT ON COLUMN at_bats.field_zone IS 'Specific zone within field area (DEEP_LEFT_FIELD, LEFT_FIELD_LINE, etc.)';
COMMENT ON COLUMN at_bats.hit_distance IS 'Estimated hit distance (SHORT, MEDIUM, DEEP)';
COMMENT ON COLUMN at_bats.hit_angle IS 'Hit angle (PULL, CENTER, OPPO)';

