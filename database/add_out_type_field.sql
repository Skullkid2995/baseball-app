-- Add out_type field to at_bats table
ALTER TABLE at_bats
ADD COLUMN out_type VARCHAR(50) DEFAULT '';

-- Add comment to explain the field
COMMENT ON COLUMN at_bats.out_type IS 'Type of out for base runners: TAGGED_OUT, CAUGHT_STEALING, FORCE_OUT';

