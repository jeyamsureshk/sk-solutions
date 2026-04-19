-- Add role column to operators table
ALTER TABLE operators ADD COLUMN role text NOT NULL DEFAULT 'Operator';
