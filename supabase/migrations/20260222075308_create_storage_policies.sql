-- Create storage bucket for study materials if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload to study-materials bucket
CREATE POLICY "Authenticated users can upload study materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'study-materials');

-- Policy to allow authenticated users to view study materials
CREATE POLICY "Authenticated users can view study materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'study-materials');

-- Policy to allow authenticated users to update their own study materials
CREATE POLICY "Authenticated users can update study materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'study-materials')
WITH CHECK (bucket_id = 'study-materials');

-- Policy to allow authenticated users to delete study materials
CREATE POLICY "Authenticated users can delete study materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'study-materials');
