-- Create component scans table for AI component counting
CREATE TABLE IF NOT EXISTS public.component_scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  operator_id integer REFERENCES public.operators(id) ON DELETE SET NULL,
  date date NOT NULL,
  total_count integer NOT NULL CHECK (total_count >= 0),
  breakdown jsonb NOT NULL,
  image_url text,
  remarks text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.component_scans ENABLE ROW LEVEL SECURITY;

-- Policies: Operators can insert their own scans
CREATE POLICY "Operators can insert own scans" ON public.component_scans
  FOR INSERT TO authenticated
  WITH CHECK (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

-- Operators can view own scans
CREATE POLICY "Operators can view own scans" ON public.component_scans
  FOR SELECT TO authenticated
  USING (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

-- Index for queries
CREATE INDEX idx_component_scans_operator_date ON public.component_scans (operator_id, date DESC);
CREATE INDEX idx_component_scans_date ON public.component_scans (date DESC);

-- View recent scans per operator
CREATE VIEW public.recent_component_scans AS
SELECT 
  cs.*,
  o.name as operator_name,
  o.team
FROM public.component_scans cs
JOIN public.operators o ON cs.operator_id = o.id
ORDER BY cs.created_at DESC;
