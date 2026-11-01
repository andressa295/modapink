-- Supabase Storage also checks authenticated object metadata before a private download.
-- Both operations still require the same valid capability and current assigned order.
begin;
alter policy mf_portal_images_read on storage.objects using (
  bucket_id='confeccao-images' and (
    ((storage.allow_only_operation('storage.object.get_authenticated') or storage.allow_only_operation('storage.object.get_authenticated_info'))
      and mf_private.portal_storage_access(name,'read'))
    or ((storage.allow_only_operation('storage.object.delete') or storage.allow_only_operation('storage.object.delete_many'))
      and mf_private.portal_storage_access(name,'delete'))
  )
);
commit;
