-- Add model_name to cycle_time_records

ALTER TABLE cycle_time_records ADD COLUMN model_name TEXT NOT NULL DEFAULT '';
