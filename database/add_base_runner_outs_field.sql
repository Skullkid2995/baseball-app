-- Add base_runner_outs field to at_bats table
ALTER TABLE at_bats
ADD COLUMN base_runner_outs JSONB DEFAULT '{"first": false, "second": false, "third": false, "home": false}';

-- Add comment to explain the field
COMMENT ON COLUMN at_bats.base_runner_outs IS 'JSON object storing which base runners were out: {first: boolean, second: boolean, third: boolean, home: boolean}';

