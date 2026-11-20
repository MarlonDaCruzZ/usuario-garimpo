-- Garimpo: schema inicial
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Perfil de cada usuário (criado automaticamente no cadastro)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  daily_digest boolean not null default true,
  email_alerts boolean not null default true,
  created_at timestamptz not null default now()
);

-- Itens no radar de compra
create table public.radar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('query', 'url')),
  title text not null,
  query text,
  url text,
  must_include text[] not null default '{}',   -- palavras obrigatórias no título da oferta
  must_exclude text[] not null default '{}',   -- palavras proibidas (ex: "usado", "notebook")
  min_price numeric(12,2),                     -- ignora ofertas suspeitas abaixo disso
  target_price numeric(12,2),
  drop_pct numeric(5,2) not null default 10,
  notify_target boolean not null default true,
  notify_drop boolean not null default true,
  notify_low boolean not null default true,
  active boolean not null default true,
  best_price numeric(12,2),
  best_store text,
  best_url text,
  best_title text,
  best_image text,
  lowest_ever numeric(12,2),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint radar_kind_fields check (
    (kind = 'query' and query is not null) or (kind = 'url' and url is not null)
  )
);
create index radar_items_user_idx on public.radar_items(user_id);
create index radar_items_active_idx on public.radar_items(active, last_checked_at);

-- Ofertas encontradas na última checagem de cada item
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.radar_items(id) on delete cascade,
  store text not null,
  title text not null,
  price numeric(12,2) not null,
  url text not null,
  image text,
  source text not null,
  seen_at timestamptz not null default now(),
  unique (item_id, url)
);
create index offers_item_idx on public.offers(item_id, price);

-- Histórico: melhor preço de cada checagem
create table public.price_history (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.radar_items(id) on delete cascade,
  price numeric(12,2) not null,
  store text,
  url text,
  checked_at timestamptz not null default now()
);
create index price_history_item_idx on public.price_history(item_id, checked_at desc);

-- Alertas enviados (evita mandar o mesmo alerta repetido)
create table public.alerts (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.radar_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('target', 'drop', 'lowest')),
  price numeric(12,2) not null,
  store text,
  url text,
  sent_at timestamptz not null default now()
);
create index alerts_item_idx on public.alerts(item_id, type, sent_at desc);

-- Programas de afiliado por domínio de loja (gerenciado pelo dono do app)
create table public.affiliate_programs (
  domain text primary key,          -- ex: amazon.com.br
  query_param text,                 -- ex: tag
  param_value text,                 -- ex: garimpo-20
  url_template text,                -- alternativa: https://parceiro.com/r?u={url}
  active boolean not null default true
);

-- Cache de buscas por nome (economiza cota da SerpAPI entre usuários)
create table public.search_cache (
  cache_key text primary key,
  source text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.radar_items enable row level security;
alter table public.offers enable row level security;
alter table public.price_history enable row level security;
alter table public.alerts enable row level security;
alter table public.affiliate_programs enable row level security;
alter table public.search_cache enable row level security;

create policy "perfil: dono le" on public.profiles for select using ((select auth.uid()) = id);
create policy "perfil: dono edita" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "radar: dono le" on public.radar_items for select using ((select auth.uid()) = user_id);
create policy "radar: dono cria" on public.radar_items for insert with check ((select auth.uid()) = user_id);
create policy "radar: dono edita" on public.radar_items for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "radar: dono apaga" on public.radar_items for delete using ((select auth.uid()) = user_id);

create policy "ofertas: dono do item le" on public.offers for select
  using (exists (select 1 from public.radar_items r where r.id = item_id and r.user_id = (select auth.uid())));
create policy "historico: dono do item le" on public.price_history for select
  using (exists (select 1 from public.radar_items r where r.id = item_id and r.user_id = (select auth.uid())));
create policy "alertas: dono le" on public.alerts for select using ((select auth.uid()) = user_id);
create policy "afiliados: leitura publica" on public.affiliate_programs for select using (true);
-- search_cache: sem policies = só service_role acessa

-- ===== Perfil automático no cadastro =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Limite de itens por usuário (protege a cota de buscas)
create or replace function public.enforce_radar_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.radar_items where user_id = new.user_id) >= 20 then
    raise exception 'Limite de 20 itens no radar atingido';
  end if;
  return new;
end $$;

create trigger radar_limit before insert on public.radar_items
  for each row execute function public.enforce_radar_limit();
