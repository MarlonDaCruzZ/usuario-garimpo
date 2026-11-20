# Garimpo 🦜

Radar de ofertas: o usuário coloca no radar o que quer comprar (pelo nome ou colando o link) e o Garimpo vasculha as lojas a cada 6 horas, guarda o histórico e manda e-mail quando o preço cai.

## Arquitetura

| Parte | Onde roda | O que faz |
|---|---|---|
| App (Next.js 16) | Vercel | Login, radar, histórico, ajustes |
| Banco + Auth | Supabase | Tabelas com RLS (cada usuário só vê o próprio radar) |
| Edge Function `garimpo` | Supabase | Busca preços, aplica filtros, grava ofertas, envia alertas |
| Agendamento | Supabase `pg_cron` | Checagem de hora em hora (cada item a cada ~6h) + resumo diário às 8h |
| E-mail | Resend | Alertas e resumo diário |

### Fontes de preço
- **Buscapé**: comparador grátis que reúne ofertas de várias lojas (Amazon, Magalu, Casas Bahia...).
- **KaBuM!**: API pública de catálogo (o site em si bloqueia servidores).
- **Google Shopping via SerpAPI**: opcional; ativa ao configurar `SERPAPI_KEY`. Cache de 20h por busca.
- **Mercado Livre (API oficial)**: opcional, ativa ao configurar `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e `ML_REFRESH_TOKEN`.
- **Link colado**: lê os dados estruturados (JSON-LD / meta tags) da página do produto, o que funciona na maioria das lojas.

### Alertas
- Preço-alvo atingido
- Queda de X% desde a última checagem
- Menor preço já visto
- Resumo diário

Um mesmo alerta não é repetido em 24h, a não ser que o preço caia ainda mais.

### Afiliados
Cadastre na tabela `affiliate_programs`:
```sql
insert into affiliate_programs (domain, query_param, param_value) values ('amazon.com.br', 'tag', 'seutag-20');
-- ou com redirecionador:
insert into affiliate_programs (domain, url_template) values ('exemplo.com.br', 'https://parceiro.com/r?u={url}');
```

## Variáveis

**Vercel**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

**Segredos** (variável da Edge Function ou Vault com prefixo `garimpo_`, ex.: `garimpo_resend_api_key`)
- `SERPAPI_KEY`: chave da https://serpapi.com
- `RESEND_API_KEY`: chave da https://resend.com
- `RESEND_FROM`: opcional; sem domínio verificado, use `Garimpo <onboarding@resend.dev>`, que só entrega para o e-mail dono da conta Resend
- `CRON_SECRET`: segredo aleatório, igual ao guardado no Vault
- `APP_URL`: URL do app na Vercel, usada nos links dos e-mails
- `CHECK_EVERY_HOURS` (padrão 6) e `SERPAPI_CACHE_HOURS` (padrão 20)

## Banco
Rodar as migrations de `supabase/migrations` em ordem. Projetos novos do Supabase exigem os GRANTs de `0003_grants.sql`.

Links colados de Pichau, Terabyte e Magalu não funcionam (as lojas bloqueiam servidores); use a busca por nome, que pega essas lojas pelo Buscapé.

## Desenvolvimento
```bash
npm install
npm run dev
```
