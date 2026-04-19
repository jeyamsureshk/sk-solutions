-- Add net_salary column to operators table
ALTER TABLE public.operators 
ADD COLUMN net_salary TEXT;
