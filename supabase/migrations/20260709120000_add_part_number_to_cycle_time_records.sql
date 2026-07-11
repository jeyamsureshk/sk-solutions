-- Store part_number as JSON for cycle-time lookups by part number and team
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cycle_time_records'
      AND column_name = 'part_number'
  ) THEN
    ALTER TABLE public.cycle_time_records
      ALTER COLUMN part_number TYPE jsonb
      USING CASE
        WHEN part_number IS NULL THEN NULL
        WHEN part_number::text ~ '^[\[{]' THEN part_number::jsonb
        ELSE jsonb_build_object('part_number', part_number)
      END;
  ELSE
    ALTER TABLE public.cycle_time_records
      ADD COLUMN part_number jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cycle_time_records_part_number
ON public.cycle_time_records USING gin (part_number);
