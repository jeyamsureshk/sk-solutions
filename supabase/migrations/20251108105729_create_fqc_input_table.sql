/*
  # Create FQC Input Table

  Creates table for storing FQC (Final Quality Check) input quantities per model per date.

  ## Table: fqc_input
  - entry_date (date) - Date of entry
  - model_name (text) - Model name
  - fqc_qty (integer) - FQC quantity input
  - created_at (timestamptz) - Creation timestamp
  - updated_at (timestamptz) - Update timestamp

  ## Constraints
  - Primary key on entry_date, model_name
  - fqc_qty >= 0

  ## Security
  - Enable RLS
  - Policies for authenticated users
*/

-- Create fqc_input table
CREATE TABLE IF NOT EXISTS fqc_input (
  entry_date date NOT NULL,
  model_name text NOT NULL,
  fqc_qty integer NOT NULL DEFAULT 0 CHECK (fqc_qty >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entry_date, model_name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fqc_input_entry_date ON fqc_input(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_fqc_input_model_name ON fqc_input(model_name);

-- Enable Row Level Security
ALTER TABLE fqc_input ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view all fqc_input records
CREATE POLICY "Authenticated users can view fqc_input"
  ON fqc_input
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert fqc_input records
CREATE POLICY "Authenticated users can insert fqc_input"
  ON fqc_input
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update fqc_input records
CREATE POLICY "Authenticated users can update fqc_input"
  ON fqc_input
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete fqc_input records
CREATE POLICY "Authenticated users can delete fqc_input"
  ON fqc_input
  FOR DELETE
  TO authenticated
  USING (true);
