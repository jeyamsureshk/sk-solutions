-- Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id INTEGER REFERENCES public.operators(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'half-day', 'leave')) DEFAULT 'present',
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  hours_worked DECIMAL(4,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_operator_date ON public.attendance_records(operator_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records(date);

-- Create overtime_records table
CREATE TABLE IF NOT EXISTS public.overtime_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id INTEGER REFERENCES public.operators(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL CHECK (hours > 0),
  rate_multiplier DECIMAL(3,2) DEFAULT 1.5 CHECK (rate_multiplier >= 1.0),
  approved BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_overtime_operator_date ON public.overtime_records(operator_id, date);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON public.overtime_records(date);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same team or own records)
CREATE POLICY "Operators can view own attendance" ON public.attendance_records
  FOR SELECT USING (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Operators can insert own attendance" ON public.attendance_records
  FOR INSERT WITH CHECK (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Operators can update own attendance" ON public.attendance_records
  FOR UPDATE USING (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Operators can view own overtime" ON public.overtime_records
  FOR SELECT USING (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Operators can insert own overtime" ON public.overtime_records
  FOR INSERT WITH CHECK (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Operators can update own overtime" ON public.overtime_records
  FOR UPDATE USING (operator_id = (SELECT operator_id FROM public.profiles WHERE id = auth.uid()));

-- Seed data for operators 1,2,3 (Nov 2024)
INSERT INTO public.attendance_records (operator_id, date, status, check_in, check_out, hours_worked) VALUES
(1, '2024-11-01', 'present', '2024-11-01 08:00:00+00', '2024-11-01 17:00:00+00', 9.0),
(1, '2024-11-02', 'present', '2024-11-02 08:00:00+00', '2024-11-02 17:00:00+00', 9.0),
(1, '2024-11-03', 'absent', NULL, NULL, 0),
(2, '2024-11-01', 'late', '2024-11-01 09:30:00+00', '2024-11-01 17:00:00+00', 7.5),
(2, '2024-11-02', 'present', '2024-11-02 08:00:00+00', '2024-11-02 17:30:00+00', 9.5),
(3, '2024-11-01', 'half-day', '2024-11-01 08:00:00+00', '2024-11-01 13:00:00+00', 5.0),
(3, '2024-11-04', 'leave', NULL, NULL, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.overtime_records (operator_id, date, hours, rate_multiplier, approved, remarks) VALUES
(1, '2024-11-02', 2.0, 1.5, true, 'Weekend work'),
(2, '2024-11-05', 3.5, 2.0, false, 'Pending approval'),
(3, '2024-11-10', 1.5, 1.5, true, 'Emergency shift');

COMMIT;
