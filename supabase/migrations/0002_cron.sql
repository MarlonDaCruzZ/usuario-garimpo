-- Agendamentos do Garimpo (rodar depois de publicar a Edge Function "garimpo").
-- Antes, guarde no Vault a URL do projeto e o segredo do cron:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo valor de CRON_SECRET da função>', 'cron_secret');

create or replace function public.garimpo_call(action text)
returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/garimpo',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('action', action),
    timeout_milliseconds := 140000
  );
$$;
revoke all on function public.garimpo_call(text) from public, anon, authenticated;

-- De hora em hora pega os itens que passaram de 6h sem checagem (espalha a carga)
select cron.schedule('garimpo-check', '17 * * * *', $$select public.garimpo_call('cron_check')$$);
-- Resumo diário às 8h de Brasília (11h UTC)
select cron.schedule('garimpo-digest', '0 11 * * *', $$select public.garimpo_call('cron_digest')$$);
-- Limpa cache e histórico muito antigo
select cron.schedule('garimpo-cleanup', '30 4 * * *', $$
  delete from public.search_cache where fetched_at < now() - interval '3 days' and cache_key not like 'ml:%';
  delete from public.price_history where checked_at < now() - interval '365 days';
$$);
