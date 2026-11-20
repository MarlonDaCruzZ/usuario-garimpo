import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { PriceChart } from "@/components/price-chart";
import { requireUser } from "@/lib/supabase/server";
import { brl, timeAgo } from "@/lib/format";
import { checkNow, deleteItem, updateItem } from "../actions";

export default async function ItemPage({ params }: PageProps<"/radar/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase.from("radar_items").select("*").eq("id", id).maybeSingle();
  if (!item) notFound();
  const [{ data: offers }, { data: history }] = await Promise.all([
    supabase.from("offers").select("*").eq("item_id", id).order("price").limit(30),
    supabase.from("price_history").select("price, checked_at").eq("item_id", id).order("checked_at").limit(500),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Link href="/radar" className="inline-flex items-center gap-1 text-sm font-bold text-arara-700 hover:underline">
          <ArrowLeft size={15} /> Meu radar
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-extrabold">{item.title}</h1>
            <p className="text-sm text-arara-900/60">
              {item.kind === "query" ? `Busca: “${item.query}”` : "Link monitorado"} · checado {timeAgo(item.last_checked_at)}
            </p>
          </div>
          <form action={checkNow.bind(null, id)}>
            <button className="btn-primary"><RefreshCw size={15} /> Checar agora</button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Melhor preço agora" value={brl(item.best_price)} sub={item.best_store} highlight />
          <Stat label="Menor já visto" value={brl(item.lowest_ever)} />
          <Stat label="Seu alvo" value={brl(item.target_price)} sub={item.target_price && item.best_price ? diff(item.best_price, item.target_price) : undefined} />
        </div>

        <section className="card mt-4 p-5">
          <h2 className="font-display text-xl font-bold">Histórico</h2>
          <PriceChart points={history ?? []} target={item.target_price} />
        </section>

        <section className="card mt-4 p-5">
          <h2 className="font-display text-xl font-bold">Ofertas encontradas</h2>
          {item.last_error && (
            <p className="mt-2 rounded-xl bg-sol-100 px-3 py-2 text-xs text-arara-900/80">Aviso da última checagem: {item.last_error}</p>
          )}
          <ul className="mt-2 divide-y divide-arara-100">
            {offers?.map((o, i) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                {o.image ? <img src={o.image} alt="" className="h-12 w-12 rounded-lg object-contain" /> : <div className="h-12 w-12 rounded-lg bg-arara-50" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{o.title}</div>
                  <div className="text-xs text-arara-900/60">{o.store}</div>
                </div>
                <a href={o.url} target="_blank" rel="noopener noreferrer sponsored"
                  className={`btn ${i === 0 ? "btn-sol" : "btn-ghost ring-1 ring-arara-200"} whitespace-nowrap`}>
                  {brl(o.price)} <ExternalLink size={13} />
                </a>
              </li>
            ))}
          </ul>
          {!offers?.length && <p className="py-6 text-center text-sm text-arara-900/60">Nenhuma oferta ainda. Ajuste os filtros ou clique em Checar agora.</p>}
        </section>

        <section className="card mt-4 p-5">
          <h2 className="font-display text-xl font-bold">Ajustes</h2>
          <form action={updateItem.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-2">
            <Field name="title" label="Nome" defaultValue={item.title} />
            <Field name="target_price" label="Preço-alvo (R$)" defaultValue={item.target_price ?? ""} />
            {item.kind === "query" && (
              <>
                <Field name="must_include" label="Precisa ter no título" defaultValue={item.must_include?.join(", ")} />
                <Field name="must_exclude" label="Ignorar se tiver" defaultValue={item.must_exclude?.join(", ")} />
                <Field name="min_price" label="Ignorar abaixo de (R$)" defaultValue={item.min_price ?? ""} />
              </>
            )}
            <Field name="drop_pct" label="Avisar se cair (%)" defaultValue={item.drop_pct} />
            <div className="flex flex-wrap gap-x-5 gap-y-2 md:col-span-2">
              <Check name="notify_target" label="Avisar no preço-alvo" on={item.notify_target} />
              <Check name="notify_drop" label="Avisar queda %" on={item.notify_drop} />
              <Check name="notify_low" label="Avisar menor preço" on={item.notify_low} />
              <Check name="active" label="Monitorando" on={item.active} />
            </div>
            <div className="md:col-span-2"><button className="btn-primary">Salvar</button></div>
          </form>
          <form action={deleteItem.bind(null, id)} className="mt-6 border-t border-arara-100 pt-4">
            <button className="btn text-red-700 hover:bg-red-50"><Trash2 size={15} /> Remover do radar</button>
          </form>
        </section>
      </main>
    </>
  );
}

function diff(best: number, target: number) {
  const d = Number(best) - Number(target);
  return d <= 0 ? "Já está no alvo! 🎯" : `faltam ${brl(d)}`;
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub?: string | null; highlight?: boolean }) {
  return (
    <div className={`card p-5 ${highlight ? "bg-arara-700 text-white" : ""}`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${highlight ? "text-sol-300" : "text-arara-800/60"}`}>{label}</div>
      <div className="font-display text-3xl font-extrabold">{value}</div>
      {sub && <div className={`text-sm ${highlight ? "text-arara-100" : "text-arara-900/60"}`}>{sub}</div>}
    </div>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | number }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={defaultValue} className="input" />
    </div>
  );
}

function Check({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 accent-arara-700" /> {label}
    </label>
  );
}
