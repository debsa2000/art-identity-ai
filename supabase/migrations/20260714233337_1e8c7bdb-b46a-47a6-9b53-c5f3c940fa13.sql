
DROP POLICY IF EXISTS "Owners read own artworks" ON storage.objects;
DROP POLICY IF EXISTS "Owners read own avatars" ON storage.objects;

CREATE POLICY "Owners read own artworks"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'artworks'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners read own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
