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
