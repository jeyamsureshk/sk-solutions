/*
  # Production Tracking System Database Schema

  ## Overview
  Creates comprehensive database structure for hourly production tracking system with summary analytics.

  ## 1. New Tables

  ### `production_records`
  Main table storing hourly production entries
  - `id` (uuid, primary key) - Unique record identifier
  - `date` (date) - Production date
  - `hour` (integer) - Hour of production (0-23)
  - `units_produced` (integer) - Actual units produced
  - `target_units` (integer) - Target units for the hour
  - `operator_name` (text) - Name of the operator
  - `team` (text) - Team name/identifier
  - `remarks` (text) - Optional remarks/notes
  - `efficiency` (numeric) - Auto-calculated efficiency percentage
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage production records
  
  ## 3. Indexes
  - Index on date and hour for fast querying
  - Index on created_at for realtime ordering

  ## 4. Functions
  - Trigger to auto-calculate efficiency on insert/update
*/

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id integer PRIMARY KEY,
  name text NOT NULL,
  team text NOT NULL,
  role text NOT NULL DEFAULT 'Operator',
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create production_records table
-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main table
CREATE TABLE IF NOT EXISTS production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  hour numeric(4,1) NOT NULL CHECK (hour >= 0 AND hour <= 23.5),
  manpower int2 NOT NULL DEFAULT 0 CHECK (manpower >= 0),
  item jsonb,
  units_produced integer NOT NULL DEFAULT 0 CHECK (units_produced >= 0),
  target_units integer NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  efficiency numeric(5,2) DEFAULT 0 CHECK (efficiency >= 0 AND efficiency <= 100),
  remarks text DEFAULT '',
  team text NOT NULL,
  operator_id integer REFERENCES operators(id),
  operator_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger binding
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON production_records
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();


-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_production_records_date_hour ON production_records(date DESC, hour DESC);
CREATE INDEX IF NOT EXISTS idx_production_records_created_at ON production_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operators_id ON operators(id);

-- Add unique constraint to prevent duplicate team entries for same date/hour
ALTER TABLE production_records ADD CONSTRAINT unique_team_per_hour UNIQUE (date, hour, team);

-- Function to calculate efficiency
CREATE OR REPLACE FUNCTION calculate_efficiency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_units > 0 THEN
    NEW.efficiency := ROUND((NEW.units_produced::numeric / NEW.target_units::numeric * 100), 2);
  ELSE
    NEW.efficiency := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate efficiency
DROP TRIGGER IF EXISTS trigger_calculate_efficiency ON production_records;
CREATE TRIGGER trigger_calculate_efficiency
  BEFORE INSERT OR UPDATE ON production_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_efficiency();

-- Enable Row Level Security
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operators
-- Allow authenticated users to view all operators



-- Create messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Create indexes for better performance
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create yield table
CREATE TABLE yield (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  model_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  supplier_name text NOT NULL DEFAULT '',
  problem TEXT,
  operator_id INTEGER REFERENCES operators(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE yield ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view all yield records" ON yield FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert their own yield records" ON yield FOR INSERT WITH CHECK (auth.uid()::text = (SELECT id::text FROM operators WHERE id = operator_id));
CREATE POLICY "Users can update their own yield records" ON yield FOR UPDATE USING (auth.uid()::text = (SELECT id::text FROM operators WHERE id = operator_id));
CREATE POLICY "Users can delete their own yield records" ON yield FOR DELETE USING (auth.uid()::text = (SELECT id::text FROM operators WHERE id = operator_id));

-- Alter profiles table to add operator_id and profile columns, and set up RLS policies

-- Note: Supabase automatically creates the profiles table, but we need to ensure it has the right structure
-- If profiles table exists, alter it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- Add operator_id if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'operator_id') THEN
            ALTER TABLE profiles ADD COLUMN operator_id integer REFERENCES operators(id);
        END IF;

        -- Add profile column if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'profile') THEN
            ALTER TABLE profiles ADD COLUMN profile jsonb;
        END IF;
    ELSE
        -- Create profiles table if it doesn't exist
        CREATE TABLE profiles (
            id uuid REFERENCES auth.users(id) PRIMARY KEY,
            full_name text,
            email text,
            operator_id integer REFERENCES operators(id),
            role text,
            profile jsonb,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
    END IF;
END $$;

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Bypass RLS for the insert
  SET LOCAL row_security = off;
  INSERT INTO public.profiles (id, full_name, email, operator_id, profile)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, (new.raw_user_meta_data->>'operator_id')::integer, new.raw_user_meta_data);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
CREATE TYPE team_enum AS ENUM ('SMT', 'THT', 'FG', 'FQC', 'Packing');


-- Create cycle_time_records table
CREATE TABLE IF NOT EXISTS cycle_time_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  model_name text NOT NULL,
  stages jsonb NOT NULL,
  overall_average numeric(10,2) NOT NULL DEFAULT 0,
  cycles_per_hour numeric(10,2) NOT NULL DEFAULT 0,
  team team_enum NOT NULL,
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
-- Add model_name to cycle_time_records


-- Create enum for operator roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operator_role') THEN
    CREATE TYPE operator_role AS ENUM ('admin', 'operator', 'manager', 'key_operator', 'engineer', 'supervisor');
  END IF;
END$$;

-- Add missing enum values if enum already exists
ALTER TYPE operator_role ADD VALUE IF NOT EXISTS 'key_operator';
ALTER TYPE operator_role ADD VALUE IF NOT EXISTS 'engineer';
ALTER TYPE operator_role ADD VALUE IF NOT EXISTS 'supervisor';

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id integer PRIMARY KEY,
  name text NOT NULL,
  email text,
  team text NOT NULL,
  role operator_role,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create production_records table
CREATE TABLE IF NOT EXISTS production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
  units_produced integer NOT NULL DEFAULT 0 CHECK (units_produced >= 0),
  target_units integer NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  operator_id integer REFERENCES operators(id),
  operator_name text NOT NULL,
  team text NOT NULL,
  remarks text DEFAULT '',
  efficiency numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_records_date_hour ON production_records(date DESC, hour DESC);
CREATE INDEX IF NOT EXISTS idx_production_records_created_at ON production_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operators_id ON operators(id);

-- Function to calculate efficiency
CREATE OR REPLACE FUNCTION calculate_efficiency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_units > 0 THEN
    NEW.efficiency := ROUND((NEW.units_produced::numeric / NEW.target_units::numeric * 100), 2);
  ELSE
    NEW.efficiency := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate efficiency
DROP TRIGGER IF EXISTS trigger_calculate_efficiency ON production_records;
CREATE TRIGGER trigger_calculate_efficiency
  BEFORE INSERT OR UPDATE ON production_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_efficiency();

-- Enable Row Level Security
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operators
CREATE POLICY "Authenticated users can view operators"
  ON operators
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert operators"
  ON operators
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update operators"
  ON operators
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete operators"
  ON operators
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for production_records
CREATE POLICY "Authenticated users can view production records"
  ON production_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert production records"
  ON production_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update production records"
  ON production_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete production records"
  ON production_records
  FOR DELETE
  TO authenticated
  USING (true);
create policy "users can delete receiver messages"
on messages for delete
using (receiver_id = auth.uid());

-- Enable Row Level Security on the table
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

-- Policy: allow public (unauthenticated) users to read
CREATE POLICY "Public can read operators"
ON operators
FOR SELECT
USING (true);

-- No insert/update/delete policies for public users
-- → those actions are denied automatically

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read messages where they are sender or receiver
CREATE POLICY "Authenticated users can read their messages"
ON messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- INSERT: authenticated users can insert messages only as themselves (sender_id must match auth.uid)
CREATE POLICY "Authenticated users can insert messages"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- UPDATE: authenticated users can update their own messages
-- (e.g., mark as read, edit content if allowed)
CREATE POLICY "Authenticated users can update their messages"
ON messages
FOR UPDATE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
)
WITH CHECK (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- DELETE: authenticated users can delete their own messages
CREATE POLICY "Authenticated users can delete their messages"
ON messages
FOR DELETE
USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Enable Row Level Security
ALTER TABLE yield ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all yield records
CREATE POLICY "Authenticated users can read yield"
ON yield
FOR SELECT
USING (auth.role() = 'authenticated');

-- INSERT: authenticated users can insert new yield records
CREATE POLICY "Authenticated users can insert yield"
ON yield
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: authenticated users can update yield records
CREATE POLICY "Authenticated users can update yield"
ON yield
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- DELETE: authenticated users can delete yield records
CREATE POLICY "Authenticated users can delete yield"
ON yield
FOR DELETE
USING (auth.role() = 'authenticated');

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can read all yield records
CREATE POLICY "Authenticated users can read profiles"
ON profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable pg_cron if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a daily cleanup job at 3 AM
SELECT cron.schedule(
  'delete_old_messages',          -- job name
  '0 3 * * *',                    -- run every day at 3 AM
  $$
    DELETE FROM messages
    WHERE created_at < now() - interval '7 days';
  $$
);

/*
  # Study Materials Database Schema

  ## Overview
  Creates table for storing study materials with categories and topics.

  ## 1. New Tables

  ### `study_materials`
  Table storing study materials
  - `id` (uuid, primary key) - Unique material identifier
  - `category` (text) - Category name
  - `title` (text) - Topic title
  - `content` (text) - Topic content
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Security
  - Enable RLS on table
  - Add policies for authenticated users to manage study materials

  ## 3. Indexes
  - Index on category for grouping
  - Index on created_at for ordering
*/

-- Create study_materials table
CREATE TABLE IF NOT EXISTS study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_study_materials_category ON study_materials(category);
CREATE INDEX IF NOT EXISTS idx_study_materials_created_at ON study_materials(created_at DESC);

-- Enable Row Level Security
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view all study materials
CREATE POLICY "Authenticated users can view study materials"
  ON study_materials
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert study materials
CREATE POLICY "Authenticated users can insert study materials"
  ON study_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update study materials
CREATE POLICY "Authenticated users can update study materials"
  ON study_materials
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete study materials
CREATE POLICY "Authenticated users can delete study materials"
  ON study_materials
  FOR DELETE
  TO authenticated
  USING (true);
