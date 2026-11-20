// Edge Function principal do Garimpo.
// Ações:
//   preview      (usuário logado)  -> busca ofertas sem salvar
//   check_item   (usuário logado)  -> checa agora um item do próprio radar
//   cron_check   (x-cron-secret)   -> checa itens vencidos (roda de hora em hora, cada item a cada ~6h)
//   cron_digest  (x-cron-secret)   -> manda o resumo diário
import { createClient } from "npm:@supabase/supabase-js@2";
import { Cache, collect, Offer } from "./sources.ts";
import { secret } from "./secrets.ts";
import { AlertLine, alertEmail, digestEmail, DigestLine, sendEmail } from "./email.ts";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-cron-secret, apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cache: Cache = {
  async get(key, maxAgeHours) {
    const { data } = await admin.from("search_cache").select("payload, fetched_at").eq("cache_key", key).maybeSingle();
    if (!data) return null;
    const age = (Date.now() - new Date(data.fetched_at).getTime()) / 36e5;
    return age <= maxAgeHours ? data.payload : null;
  },
  async set(key, source, payload) {
    await admin.from("search_cache").upsert({ cache_key: key, source, payload, fetched_at: new Date().toISOString() });
  },
};

type Item = {
  id: string; user_id: string; kind: string; title: string; query: string | null; url: string | null;
  must_include: string[]; must_exclude: string[]; min_price: number | null;
  target_price: number | null; drop_pct: number; notify_target: boolean; notify_drop: boolean; notify_low: boolean;
  best_price: number | null; lowest_ever: number | null;
};

// ---------- Afiliados ----------
type Aff = { domain: string; query_param: string | null; param_value: string | null; url_template: string | null };
let affCache: Aff[] | null = null;
async function affiliate(url: string): Promise<string> {
  affCache ??= ((await admin.from("affiliate_programs").select("*").eq("active", true)).data ?? []) as Aff[];
  let host: string;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  const p = affCache.find((a) => host === a.domain || host.endsWith("." + a.domain));
  if (!p) return url;
  if (p.url_template) return p.url_template.replace("{url}", encodeURIComponent(url));
  if (p.query_param && p.param_value) {
    const u = new URL(url);
    u.searchParams.set(p.query_param, p.param_value);
    return u.toString();
  }
  return url;
}

// ---------- Checagem de um item ----------
async function recentlyAlerted(itemId: string, type: string, price: number) {
  const since = new Date(Date.now() - 24 * 36e5).toISOString();
  const { data } = await admin.from("alerts").select("price").eq("item_id", itemId).eq("type", type)
    .gte("sent_at", since).lte("price", price).limit(1);
  return (data?.length ?? 0) > 0;
}

async function checkItem(item: Item): Promise<{ alert: AlertLine | null; offers: Offer[]; errors: string[] }> {
  const { offers, errors } = await collect(item, cache);
  for (const o of offers) o.url = await affiliate(o.url);

  const now = new Date().toISOString();
  await admin.from("offers").delete().eq("item_id", item.id);

  if (!offers.length) {
    await admin.from("radar_items").update({
      last_checked_at: now,
      last_error: errors.length ? errors.join(" | ") : "Nenhuma oferta encontrada com esses filtros",
    }).eq("id", item.id);
    return { alert: null, offers, errors };
  }

  await admin.from("offers").insert(offers.map((o) => ({ ...o, item_id: item.id, seen_at: now })));
  const best = offers[0];
  await admin.from("price_history").insert({ item_id: item.id, price: best.price, store: best.store, url: best.url });

  // Regras de alerta
  const reasons: string[] = [];
  const types: string[] = [];
  if (item.notify_target && item.target_price && best.price <= item.target_price && !(await recentlyAlerted(item.id, "target", best.price))) {
    reasons.push("Atingiu seu preço-alvo"); types.push("target");
  }
  if (item.notify_drop && item.best_price && best.price <= item.best_price * (1 - item.drop_pct / 100) && !(await recentlyAlerted(item.id, "drop", best.price))) {
    const pct = Math.round((1 - best.price / item.best_price) * 100);
    reasons.push(`Caiu ${pct}%`); types.push("drop");
  }
  if (item.notify_low && item.lowest_ever && best.price < item.lowest_ever && !(await recentlyAlerted(item.id, "lowest", best.price))) {
    reasons.push("Menor preço já visto"); types.push("lowest");
  }

  await admin.from("radar_items").update({
    best_price: best.price, best_store: best.store, best_url: best.url, best_title: best.title, best_image: best.image ?? null,
    lowest_ever: item.lowest_ever ? Math.min(item.lowest_ever, best.price) : best.price,
    last_checked_at: now, last_error: errors.length ? errors.join(" | ") : null,
  }).eq("id", item.id);

  if (!types.length) return { alert: null, offers, errors };
  await admin.from("alerts").insert(types.map((type) => ({
    item_id: item.id, user_id: item.user_id, type, price: best.price, store: best.store, url: best.url,
  })));
  return {
    alert: { itemTitle: item.title, reasons, price: best.price, store: best.store, url: best.url, image: best.image },
    offers, errors,
  };
}

async function emailFor(userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("email, email_alerts").eq("id", userId).single();
  return data?.email_alerts ? data.email : null;
}

async function sendAlerts(byUser: Map<string, AlertLine[]>) {
  for (const [userId, lines] of byUser) {
    const to = await emailFor(userId);
    if (!to) continue;
    const { subject, html } = alertEmail(lines, (await secret("APP_URL")) ?? "");
    try { await sendEmail(to, subject, html); } catch (e) { console.error("email", userId, (e as Error).message); }
  }
}

// ---------- Cron: checagem em lote ----------
async function cronCheck() {
  const hours = Number(Deno.env.get("CHECK_EVERY_HOURS") ?? "6");
  const cutoff = new Date(Date.now() - (hours - 0.5) * 36e5).toISOString();
  const { data: items } = await admin.from("radar_items").select("*").eq("active", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${cutoff}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true }).limit(25);

  const byUser = new Map<string, AlertLine[]>();
  let checked = 0;
  const queue = [...(items ?? [])] as Item[];
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        const { alert } = await checkItem(item);
        checked++;
        if (alert) byUser.set(item.user_id, [...(byUser.get(item.user_id) ?? []), alert]);
      } catch (e) {
        await admin.from("radar_items").update({ last_checked_at: new Date().toISOString(), last_error: (e as Error).message }).eq("id", item.id);
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await sendAlerts(byUser);
  return { checked, alerts: [...byUser.values()].flat().length };
}

// ---------- Cron: resumo diário ----------
async function cronDigest() {
  const { data: profiles } = await admin.from("profiles").select("id, email").eq("daily_digest", true);
  let sent = 0;
  for (const p of profiles ?? []) {
    const { data: items } = await admin.from("radar_items")
      .select("id, title, best_price, best_store, best_url, target_price").eq("user_id", p.id).eq("active", true).order("created_at");
    if (!items?.length) continue;
    const since = new Date(Date.now() - 24 * 36e5).toISOString();
    const lines: DigestLine[] = [];
    for (const it of items) {
      const { data: old } = await admin.from("price_history").select("price").eq("item_id", it.id)
        .lte("checked_at", since).order("checked_at", { ascending: false }).limit(1);
      const prev = old?.[0]?.price ?? null;
      lines.push({
        title: it.title, price: it.best_price, store: it.best_store, url: it.best_url, target: it.target_price,
        change: prev && it.best_price ? Number((it.best_price - prev).toFixed(2)) : null,
      });
    }
    const { subject, html } = digestEmail(lines, (await secret("APP_URL")) ?? "");
    try { await sendEmail(p.email, subject, html); sent++; } catch (e) { console.error("digest", p.id, (e as Error).message); }
  }
  return { sent };
}

// ---------- HTTP ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "cron_check" || action === "cron_digest") {
      const cronSecret = await secret("CRON_SECRET");
      if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "não autorizado" }, 401);
      return json(action === "cron_check" ? await cronCheck() : await cronDigest());
    }

    // Ações de usuário: valida o token do Supabase Auth
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "faça login" }, 401);

    if (action === "preview") {
      const kind = body.url ? "url" : "query";
      if (kind === "query" && (!body.query || String(body.query).trim().length < 2)) return json({ error: "digite o nome do produto" }, 400);
      if (kind === "url" && !/^https?:\/\//.test(body.url)) return json({ error: "link inválido" }, 400);
      const result = await collect({
        kind, query: body.query ?? null, url: body.url ?? null,
        must_include: body.must_include ?? [], must_exclude: body.must_exclude ?? [], min_price: body.min_price ?? null,
      }, cache);
      return json(result);
    }

    if (action === "check_item") {
      const { data: item } = await admin.from("radar_items").select("*").eq("id", body.item_id).eq("user_id", user.id).single();
      if (!item) return json({ error: "item não encontrado" }, 404);
      const { alert, offers, errors } = await checkItem(item as Item);
      if (alert) await sendAlerts(new Map([[user.id, [alert]]]));
      return json({ found: offers.length, errors });
    }

    return json({ error: "ação desconhecida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
