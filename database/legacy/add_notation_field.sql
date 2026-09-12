-- Add notation field to at_bats table to store original notation
-- Run this in your Supabase SQL Editor

-- Add notation column to store the original notation (e.g., "6-3", "K", "BB")
ALTER TABLE at_bats 
ADD COLUMN notation VARCHAR(50) DEFAULT '';

-- Add comment to explain the field
COMMENT ON COLUMN at_bats.notation IS 'Original notation entered by user (e.g., 6-3, K, BB, F-8)';

