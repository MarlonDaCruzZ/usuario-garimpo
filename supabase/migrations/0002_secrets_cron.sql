-- Segredos do Garimpo ficam no Vault. Só a service_role (Edge Function) consegue ler.
create or replace function public.garimpo_secret(secret_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'garimpo_' || secret_name limit 1;
$$;
revoke execute on function public.garimpo_secret(text) from public, anon, authenticated;
grant execute on function public.garimpo_secret(text) to service_role;

-- Chama a Edge Function a partir do cron
create or replace function public.garimpo_call(action text)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := public.garimpo_secret('project_url') || '/functions/v1/garimpo',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', public.garimpo_secret('cron_secret')),
    body := jsonb_build_object('action', action),
    timeout_milliseconds := 140000
  );
$$;
revoke execute on function public.garimpo_call(text) from public, anon, authenticated;

-- De hora em hora pega os itens com mais de 6h sem checagem (espalha a carga)
select cron.schedule('garimpo-check', '17 * * * *', $$select public.garimpo_call('cron_check')$$);
-- Resumo diário às 8h de Brasília (11h UTC)
select cron.schedule('garimpo-digest', '0 11 * * *', $$select public.garimpo_call('cron_digest')$$);
-- Limpeza
select cron.schedule('garimpo-cleanup', '30 4 * * *', $$
  delete from public.search_cache where fetched_at < now() - interval '3 days' and cache_key not like 'ml:%';
  delete from public.price_history where checked_at < now() - interval '365 days';
$$);
