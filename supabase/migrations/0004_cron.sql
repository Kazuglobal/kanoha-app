create extension if not exists pg_cron;

create or replace function public.purge_expired_materials()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from storage.objects as object
  using public.uploaded_materials as material
  join public.child_profiles as child on child.id = material.child_id
  where object.bucket_id = 'materials'
    and material.expires_at <= now()
    and material.status <> 'analyzing'
    and object.name like child.user_id::text || '/' || child.id::text || '/' || material.id::text || '/%';

  delete from public.uploaded_materials
  where expires_at <= now()
    and status <> 'analyzing';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_materials() from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'purge-expired-materials'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge-expired-materials',
    '17 3 * * *',
    'select public.purge_expired_materials();'
  );
end;
$$;
