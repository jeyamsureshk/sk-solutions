/*
  # Cycle Time Tracking Database Schema

  ## Overview
  Creates database structure for cycle time tracking with stage averages.

  ## 1. New Table

  ### `cycle_time_records`
  Main table storing cycle time entries
  - `id` (uuid, primary key) - Unique record identifier
  - `date` (date) - Cycle time date
  - `stages` (jsonb) - Array of stage objects with description, counts, and average
  - `overall_average` (numeric) - Overall average of stage averages
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
  - Enable RLS on the table
  - Add policies for authenticated users to manage cycle time records

  ## 3. Indexes
  - Index on date for fast querying
  - Index on created_at for realtime ordering
*/

-- Create cycle_time_records table
CREATE TABLE IF NOT EXISTS cycle_time_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  stages jsonb NOT NULL,
  overall_average numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cycle_time_records_date ON cycle_time_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_time_records_created_at ON cycle_time_records(created_at DESC);

-- Enable Row Level Security
ALTER TABLE cycle_time_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cycle_time_records
-- Allow authenticated users to view all records
CREATE POLICY "Authenticated users can view cycle time records"
  ON cycle_time_records
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert records
CREATE POLICY "Authenticated users can insert cycle time records"
  ON cycle_time_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update records
CREATE POLICY "Authenticated users can update cycle time records"
  ON cycle_time_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete records
CREATE POLICY "Authenticated users can delete cycle time records"
  ON cycle_time_records
  FOR DELETE
  TO authenticated
  USING (true);
