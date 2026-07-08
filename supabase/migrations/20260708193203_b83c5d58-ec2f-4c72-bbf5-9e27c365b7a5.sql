
-- Storage RLS: files stored under path "<org_id>/..."; only org members can read/write.
DROP POLICY IF EXISTS "venue-assets: org members read" ON storage.objects;
CREATE POLICY "venue-assets: org members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members write" ON storage.objects;
CREATE POLICY "venue-assets: org members write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members update" ON storage.objects;
CREATE POLICY "venue-assets: org members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "venue-assets: org members delete" ON storage.objects;
CREATE POLICY "venue-assets: org members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members read" ON storage.objects;
CREATE POLICY "application-uploads: org members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members write" ON storage.objects;
CREATE POLICY "application-uploads: org members write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "application-uploads: org members delete" ON storage.objects;
CREATE POLICY "application-uploads: org members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'application-uploads'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
