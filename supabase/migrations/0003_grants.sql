-- Projetos novos do Supabase não expõem tabelas à Data API sem GRANT explícito.
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.radar_items to authenticated;
grant select on public.offers, public.price_history, public.alerts, public.affiliate_programs to authenticated;
