
CREATE POLICY "auth insert makeover storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artworks' AND (storage.foldername(name))[1] = 'makeover');
CREATE POLICY "auth read makeover storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'artworks' AND (storage.foldername(name))[1] = 'makeover');
