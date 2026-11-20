import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Target, TrendingDown } from "lucide-react";
import { Header } from "@/components/header";
import { AddItem } from "@/components/add-item";
import { requireUser } from "@/lib/supabase/server";
import { brl, timeAgo } from "@/lib/format";

export default async function RadarPage({ searchParams }: PageProps<"/radar">) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { erro } = await searchParams;
  const { data: items } = await supabase.from("radar_items").select("*").order("created_at", { ascending: false });

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Meu radar</h1>
        <p className="text-arara-900/70">Checamos cada item a cada 6 horas. Até 20 itens por conta.</p>

        {erro && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{String(erro)}</p>}

        <div className="mt-6"><AddItem /></div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items?.map((it) => {
            const hitTarget = it.target_price && it.best_price && Number(it.best_price) <= Number(it.target_price);
            const isLowest = it.best_price && it.lowest_ever && Number(it.best_price) <= Number(it.lowest_ever);
            return (
              <Link key={it.id} href={`/radar/${it.id}`} className={`card group flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${!it.active ? "opacity-60" : ""}`}>
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-arara-50">
                  {it.best_image ? <img src={it.best_image} alt="" className="h-full w-full object-contain" /> : <span className="text-2xl">🦜</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold group-hover:text-arara-700">{it.title}</div>
                  <div className="font-display text-2xl font-extrabold text-arara-700">{brl(it.best_price)}</div>
                  <div className="text-xs text-arara-900/60">{it.best_store ?? "—"} · {timeAgo(it.last_checked_at)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {hitTarget && <Badge tone="sol"><Target size={11} /> no alvo</Badge>}
                    {isLowest && <Badge tone="mata"><TrendingDown size={11} /> menor preço</Badge>}
                    {it.target_price && !hitTarget && <Badge>alvo {brl(it.target_price)}</Badge>}
                    {it.last_error && !it.best_price && <Badge tone="red"><AlertTriangle size={11} /> sem ofertas</Badge>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {!items?.length && (
          <p className="mt-10 text-center text-arara-900/60">Seu radar está vazio. Adicione o primeiro item acima. 🦜</p>
        )}
      </main>
    </>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "sol" | "mata" | "red" }) {
  const c = tone === "sol" ? "bg-sol-500 text-arara-900" : tone === "mata" ? "bg-mata-500/15 text-mata-700" : tone === "red" ? "bg-red-50 text-red-700" : "bg-arara-50 text-arara-800";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${c}`}>{children}</span>;
}
