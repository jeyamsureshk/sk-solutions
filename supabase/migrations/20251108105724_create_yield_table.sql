-- Create yield table
CREATE TABLE yield (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  model_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
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
