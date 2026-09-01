create or replace function public.set_slack_webhook(target_child_id uuid, webhook_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if not public.owns_child(target_child_id) then
    raise exception 'child profile not found';
  end if;
  if webhook_url !~ '^https://hooks[.]slack[.]com/services/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$' then
    raise exception 'invalid Slack webhook';
  end if;

  select slack_webhook_secret_id into secret_id
  from public.app_settings
  where child_id = target_child_id;

  if secret_id is null then
    select vault.create_secret(
      webhook_url,
      'slack_webhook_' || target_child_id::text,
      'Kanoha Slack webhook for child profile'
    ) into secret_id;
  else
    perform vault.update_secret(secret_id, webhook_url);
  end if;

  insert into public.app_settings (child_id, enable_slack, slack_webhook_secret_id)
  values (target_child_id, true, secret_id)
  on conflict (child_id) do update
    set enable_slack = true,
        slack_webhook_secret_id = excluded.slack_webhook_secret_id;
end;
$$;

create or replace function public.remove_slack_webhook(target_child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret_id uuid;
begin
  if not public.owns_child(target_child_id) then
    raise exception 'child profile not found';
  end if;

  select slack_webhook_secret_id into secret_id
  from public.app_settings
  where child_id = target_child_id;

  update public.app_settings
  set enable_slack = false,
      slack_webhook_secret_id = null
  where child_id = target_child_id;

  if secret_id is not null then
    delete from vault.secrets where id = secret_id;
  end if;
end;
$$;

create or replace function public.get_slack_delivery_settings(target_child_id uuid)
returns table(enable_slack boolean, webhook_url text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select settings.enable_slack, secret.decrypted_secret
  from public.app_settings as settings
  left join vault.decrypted_secrets as secret
    on secret.id = settings.slack_webhook_secret_id
  where settings.child_id = target_child_id;
end;
$$;

revoke all on function public.set_slack_webhook(uuid, text) from public, anon;
revoke all on function public.remove_slack_webhook(uuid) from public, anon;
revoke all on function public.get_slack_delivery_settings(uuid) from public, anon;
revoke all on function public.get_slack_delivery_settings(uuid) from authenticated;
grant execute on function public.set_slack_webhook(uuid, text) to authenticated;
grant execute on function public.remove_slack_webhook(uuid) to authenticated;
grant execute on function public.get_slack_delivery_settings(uuid) to service_role;
