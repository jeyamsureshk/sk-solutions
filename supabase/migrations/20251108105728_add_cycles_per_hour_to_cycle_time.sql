-- Add cycles_per_hour to cycle_time_records

ALTER TABLE cycle_time_records ADD COLUMN cycles_per_hour numeric(10,2) NOT NULL DEFAULT 0;
