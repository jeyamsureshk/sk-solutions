-- Alter cycle_time_records.part_number from JSON/legacy values to plain text
-- Supports comma-separated part numbers such as "ABC123,XYZ789"

DROP INDEX IF EXISTS public.idx_cycle_time_records_part_number;

ALTER TABLE public.cycle_time_records
ALTER COLUMN part_number TYPE text
USING (
  CASE
    WHEN part_number IS NULL THEN NULL
    WHEN part_number::text = '' THEN ''
    WHEN part_number::text LIKE '[%' OR part_number::text LIKE '{%' THEN
      CASE
        WHEN part_number::text LIKE '[%' THEN
          (
            SELECT string_agg(
              CASE
                WHEN item::text LIKE '"%' THEN regexp_replace(item::text, '^"|"$', '', 'g')
                ELSE item::text
              END,
              ','
            )
            FROM jsonb_array_elements_text(COALESCE(part_number::jsonb, '[]'::jsonb)) AS item
          )
        ELSE
          COALESCE(
            (part_number #>> '{part_number}')::text,
            (
              SELECT string_agg(value, ',')
              FROM jsonb_array_elements_text(COALESCE(part_number->'part_numbers', '[]'::jsonb)) AS value
            )
          )
      END
    ELSE part_number::text
  END
);

CREATE INDEX IF NOT EXISTS idx_cycle_time_records_part_number
ON public.cycle_time_records USING btree (part_number);
