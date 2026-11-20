import { secret } from "./secrets.ts";
// Fontes de preço do Garimpo.
// Cada fonte devolve Offer[]; falhas são isoladas (uma loja fora do ar não derruba as outras).

export type Offer = {
  store: string;
  title: string;
  price: number;
  url: string;
  image?: string | null;
  source: string;
};

export type Cache = {
  get(key: string, maxAgeHours: number): Promise<unknown | null>;
  set(key: string, source: string, payload: unknown): Promise<void>;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

async function fetchText(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9", accept: "text/html,application/json" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  // "1.899,99" -> 1899.99 ; "1899.99" -> 1899.99
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function storeFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "kabum.com.br": "KaBuM!",
      "pichau.com.br": "Pichau",
      "terabyteshop.com.br": "Terabyte",
      "amazon.com.br": "Amazon",
      "mercadolivre.com.br": "Mercado Livre",
      "produto.mercadolivre.com.br": "Mercado Livre",
      "magazineluiza.com.br": "Magalu",
      "casasbahia.com.br": "Casas Bahia",
      "americanas.com.br": "Americanas",
      "aliexpress.com": "AliExpress",
    };
    return known[host] ?? host;
  } catch {
    return "Loja";
  }
}

// ---------- Google Shopping via SerpAPI ----------
export async function serpapiShopping(query: string, cache: Cache): Promise<Offer[]> {
  const key = await secret("SERPAPI_KEY");
  if (!key) return [];
  const cacheKey = `serpapi:${query.toLowerCase().trim()}`;
  const hours = Number(Deno.env.get("SERPAPI_CACHE_HOURS") ?? "20");
  let data = (await cache.get(cacheKey, hours)) as any;
  if (!data) {
    const u = new URL("https://serpapi.com/search.json");
    u.searchParams.set("engine", "google_shopping");
    u.searchParams.set("q", query);
    u.searchParams.set("gl", "br");
    u.searchParams.set("hl", "pt-br");
    u.searchParams.set("location", "Brazil");
    u.searchParams.set("api_key", key);
    data = JSON.parse(await fetchText(u.toString(), 30000));
    if (data.error) throw new Error(`SerpAPI: ${data.error}`);
    await cache.set(cacheKey, "serpapi", data);
  }
  const results: any[] = [...(data.shopping_results ?? []), ...(data.inline_shopping_results ?? [])];
  return results
    .map((r) => ({
      store: r.source ?? "Google Shopping",
      title: r.title ?? "",
      price: r.extracted_price ?? parsePrice(r.price),
      url: r.link ?? r.product_link ?? "",
      image: r.thumbnail ?? null,
      source: "google_shopping",
    }))
    .filter((o) => o.title && o.url && o.price) as Offer[];
}

// ---------- KaBuM (API pública de catálogo; o site bloqueia servidores) ----------
function walk(node: unknown, visit: (o: Record<string, unknown>) => void, depth = 0) {
  if (depth > 12 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit, depth + 1);
    return;
  }
  visit(node as Record<string, unknown>);
  for (const v of Object.values(node as Record<string, unknown>)) {
    if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) {
      try { walk(JSON.parse(v), visit, depth + 1); } catch { /* não é JSON */ }
    } else walk(v, visit, depth + 1);
  }
}

const KABUM_API = "https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products";

function kabumOffer(d: any): Offer | null {
  const a = d?.attributes ?? {};
  if (a.available === false) return null;
  const price = parsePrice(a.offer?.price_with_discount ?? a.price_with_discount ?? a.price);
  if (!price || !a.title) return null;
  let image: string | null = null;
  try {
    const ph = typeof a.photos === "string" ? JSON.parse(a.photos) : a.photos;
    image = ph?.m?.[0] ?? ph?.p?.[0] ?? ph?.g?.[0] ?? null;
  } catch { /* sem foto */ }
  return {
    store: "KaBuM!",
    title: a.title,
    price,
    url: `https://www.kabum.com.br/produto/${d.id}${a.product_link ? "/" + a.product_link : ""}`,
    image,
    source: "kabum",
  };
}

export async function kabumSearch(query: string, cache: Cache): Promise<Offer[]> {
  const cacheKey = `kabum:${query.toLowerCase().trim()}`;
  let offers = (await cache.get(cacheKey, 5)) as Offer[] | null;
  if (offers) return offers;
  const json = JSON.parse(await fetchText(`${KABUM_API}?query=${encodeURIComponent(query)}&page_size=40&sort=most_searched`));
  offers = (json.data ?? []).map(kabumOffer).filter(Boolean) as Offer[];
  await cache.set(cacheKey, "kabum", offers);
  return offers;
}

async function kabumProduct(url: string): Promise<Offer[] | null> {
  const id = url.match(/kabum\.com\.br\/produto\/(\d+)/)?.[1];
  if (!id) return null;
  const json = JSON.parse(await fetchText(`${KABUM_API}/${id}`));
  const o = kabumOffer(json.data);
  if (!o) throw new Error("KaBuM: produto indisponível");
  return [o];
}

// ---------- Buscapé (comparador: reúne ofertas de várias lojas) ----------
export async function buscapeSearch(query: string, cache: Cache): Promise<Offer[]> {
  const cacheKey = `buscape:${query.toLowerCase().trim()}`;
  let offers = (await cache.get(cacheKey, 5)) as Offer[] | null;
  if (offers) return offers;
  const html = await fetchText(`https://www.buscape.com.br/search?q=${encodeURIComponent(query)}`);
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Buscapé: estrutura da página mudou");
  const hits: any[] = JSON.parse(m[1])?.props?.initialReduxState?.hits?.hits ?? [];
  offers = hits
    .map((h) => {
      const price = parsePrice(h.price);
      if (!price || !h.name || !h.url) return null;
      const store = h.merchantName || h.bestOffer?.merchantName ||
        (h.storeCount ? `${h.storeCount} lojas (Buscapé)` : "Buscapé");
      return {
        store,
        title: h.name,
        price,
        url: new URL(h.url, "https://www.buscape.com.br").toString(),
        image: h.image ?? null,
        source: "buscape",
      } as Offer;
    })
    .filter(Boolean) as Offer[];
  await cache.set(cacheKey, "buscape", offers);
  return offers;
}

// ---------- Mercado Livre (API oficial, opcional) ----------
async function mlToken(cache: Cache): Promise<string | null> {
  const id = await secret("ML_CLIENT_ID");
  const clientSecret = await secret("ML_CLIENT_SECRET");
  if (!id || !clientSecret) return null;
  const cached = (await cache.get("ml:token", 5)) as { access_token: string } | null;
  if (cached) return cached.access_token;
  const stored = (await cache.get("ml:refresh", 24 * 180)) as { refresh_token: string } | null;
  const refresh = stored?.refresh_token ?? (await secret("ML_REFRESH_TOKEN"));
  if (!refresh) return null;
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: id, client_secret: clientSecret, refresh_token: refresh }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Mercado Livre token: ${json.message ?? res.status}`);
  await cache.set("ml:token", "ml", { access_token: json.access_token });
  await cache.set("ml:refresh", "ml", { refresh_token: json.refresh_token });
  return json.access_token;
}

export async function mercadoLivreSearch(query: string, cache: Cache): Promise<Offer[]> {
  const token = await mlToken(cache);
  if (!token) return [];
  const cacheKey = `ml:${query.toLowerCase().trim()}`;
  let offers = (await cache.get(cacheKey, 5)) as Offer[] | null;
  if (offers) return offers;
  const res = await fetch(
    `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&condition=new&limit=30`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Mercado Livre busca: HTTP ${res.status}`);
  const json = await res.json();
  offers = (json.results ?? []).map((r: any) => ({
    store: "Mercado Livre",
    title: r.title,
    price: r.price,
    url: r.permalink,
    image: r.thumbnail,
    source: "mercadolivre",
  }));
  await cache.set(cacheKey, "ml", offers);
  return offers!;
}

// ---------- Página de produto (link colado) ----------
// Lê dados estruturados (JSON-LD / meta tags), que a maioria das lojas publica para o Google.
export async function productPage(url: string): Promise<Offer[]> {
  const viaKabum = await kabumProduct(url);
  if (viaKabum) return viaKabum;
  let html: string;
  try {
    html = await fetchText(url);
  } catch (e) {
    if (/HTTP 403/.test((e as Error).message)) {
      throw new Error(`${storeFromUrl(url)} bloqueia leitura automática. Adicione esse produto pelo nome.`);
    }
    throw e;
  }
  let title: string | null = null;
  let image: string | null = null;
  let price: number | null = null;

  const ldBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of ldBlocks) {
    try {
      walk(JSON.parse(b[1].trim()), (o) => {
        const type = String(o["@type"] ?? "");
        if (/Product/i.test(type)) {
          title ??= (o.name as string) ?? null;
          const img = o.image as unknown;
          image ??= Array.isArray(img) ? String(img[0]) : typeof img === "string" ? img : null;
        }
        if (/Offer/i.test(type)) {
          const p = parsePrice(o.lowPrice ?? o.price);
          if (p && (price === null || p < price)) price = p;
        }
      });
    } catch { /* JSON-LD inválido */ }
  }

  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${prop}["']`, "i"))?.[1];

  price ??= parsePrice(meta("product:price:amount") ?? meta("og:price:amount") ?? meta("price"));
  title ??= meta("og:title") ?? html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  image ??= meta("og:image") ?? null;

  if (!price || !title) throw new Error(`Não consegui ler o preço em ${storeFromUrl(url)}`);
  return [{ store: storeFromUrl(url), title: decodeEntities(title), price, url, image, source: "pagina" }];
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// ---------- Filtro de relevância para buscas por nome ----------
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterOffers(
  offers: Offer[],
  opts: { query?: string | null; mustInclude?: string[]; mustExclude?: string[]; minPrice?: number | null },
): Offer[] {
  const tokens = norm(opts.query ?? "").split(/\s+/).filter((t) => t.length > 1);
  const inc = (opts.mustInclude ?? []).map(norm);
  const exc = (opts.mustExclude ?? []).map(norm);
  const seen = new Set<string>();
  return offers
    .filter((o) => {
      const t = norm(o.title);
      const words = t.split(/[^a-z0-9]+/);
      if (!tokens.every((k) => t.includes(k))) return false;
      if (!inc.every((k) => t.includes(k))) return false;
      if (exc.some((k) => words.includes(k) || (k.includes(" ") && t.includes(k)))) return false;
      if (opts.minPrice && o.price < opts.minPrice) return false;
      const key = o.url.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.price - b.price);
}

export async function collect(
  item: { kind: string; query?: string | null; url?: string | null; must_include?: string[]; must_exclude?: string[]; min_price?: number | null },
  cache: Cache,
): Promise<{ offers: Offer[]; errors: string[] }> {
  const errors: string[] = [];
  const run = async (name: string, fn: () => Promise<Offer[]>) => {
    try { return await fn(); } catch (e) { errors.push(`${name}: ${(e as Error).message}`); return []; }
  };
  if (item.kind === "url" && item.url) {
    return { offers: await run("página", () => productPage(item.url!)), errors };
  }
  const q = item.query!;
  const all = (await Promise.all([
    run("Google Shopping", () => serpapiShopping(q, cache)),
    run("KaBuM", () => kabumSearch(q, cache)),
    run("Buscapé", () => buscapeSearch(q, cache)),
    run("Mercado Livre", () => mercadoLivreSearch(q, cache)),
  ])).flat();
  const offers = filterOffers(all, {
    query: q,
    mustInclude: item.must_include,
    mustExclude: item.must_exclude,
    minPrice: item.min_price,
  }).slice(0, 30);
  return { offers, errors };
}
