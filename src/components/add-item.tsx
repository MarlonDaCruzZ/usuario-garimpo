"use client";

import { useState, useTransition } from "react";
import { Link2, Search, Loader2, ExternalLink, Plus } from "lucide-react";
import { addItem, previewSearch, type PreviewResult } from "@/app/radar/actions";
import { brl } from "@/lib/format";

export function AddItem() {
  const [kind, setKind] = useState<"query" | "url">("query");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, setSaving] = useState(false);

  function runPreview(form: HTMLFormElement) {
    const fd = new FormData(form);
    const words = (k: string) => String(fd.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    startSearch(async () => {
      setPreview(await previewSearch(
        kind === "url"
          ? { url: String(fd.get("url")) }
          : { query: String(fd.get("query")), must_include: words("must_include"), must_exclude: words("must_exclude") },
      ));
    });
  }

  return (
    <form
      action={async (fd) => { setSaving(true); await addItem(fd); }}
      className="card p-5"
    >
      <input type="hidden" name="kind" value={kind} />
      <div className="mb-4 inline-flex rounded-xl bg-arara-50 p-1">
        {([["query", "Pelo nome", Search], ["url", "Colar link", Link2]] as const).map(([k, label, Icon]) => (
          <button
            key={k} type="button"
            onClick={() => { setKind(k); setPreview(null); }}
            className={`btn px-3 py-1.5 ${kind === k ? "bg-white text-arara-700 shadow-sm" : "text-arara-900/60"}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {kind === "query" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="query">O que você quer comprar?</label>
            <input id="query" name="query" required placeholder="ex: RTX 5060 8GB" className="input text-base" />
          </div>
          <div>
            <label className="label" htmlFor="must_include">Precisa ter no título (vírgulas)</label>
            <input id="must_include" name="must_include" placeholder="ex: 8gb" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="must_exclude">Ignorar se tiver (vírgulas)</label>
            <input id="must_exclude" name="must_exclude" placeholder="ex: ti, usado, notebook" className="input" />
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="url">Link do produto</label>
          <input id="url" name="url" type="url" required placeholder="https://www.kabum.com.br/produto/..." className="input text-base" />
          <label className="label mt-3" htmlFor="title">Apelido (opcional)</label>
          <input id="title" name="title" placeholder="ex: Fone da Edifier" className="input" />
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="target_price">Preço-alvo (R$)</label>
          <input id="target_price" name="target_price" inputMode="decimal" placeholder="1900" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="drop_pct">Avisar se cair (%)</label>
          <input id="drop_pct" name="drop_pct" inputMode="decimal" defaultValue="10" className="input" />
        </div>
        {kind === "query" && (
          <div>
            <label className="label" htmlFor="min_price">Ignorar abaixo de (R$)</label>
            <input id="min_price" name="min_price" inputMode="decimal" placeholder="evita acessórios" className="input" />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={(e) => runPreview(e.currentTarget.form!)} disabled={searching} className="btn-ghost ring-1 ring-arara-200">
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Ver ofertas agora
        </button>
        <button disabled={saving} className="btn-sol">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Colocar no radar
        </button>
      </div>

      {preview && (
        <div className="mt-5 border-t border-arara-100 pt-4">
          {preview.error && <p className="text-sm text-red-700">{preview.error}</p>}
          {!preview.error && !preview.offers.length && (
            <p className="text-sm text-arara-900/70">Nada encontrado com esses filtros. Tente um nome mais curto.</p>
          )}
          <ul className="divide-y divide-arara-100">
            {preview.offers.slice(0, 8).map((o) => (
              <li key={o.url} className="flex items-center gap-3 py-2">
                {o.image ? <img src={o.image} alt="" className="h-10 w-10 rounded-lg object-contain" /> : <div className="h-10 w-10 rounded-lg bg-arara-50" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{o.title}</div>
                  <div className="text-xs text-arara-900/60">{o.store}</div>
                </div>
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-display text-lg font-extrabold text-arara-700">
                  {brl(o.price)} <ExternalLink size={13} />
                </a>
              </li>
            ))}
          </ul>
          {preview.errors.length > 0 && (
            <p className="mt-2 text-xs text-arara-900/50">Algumas lojas não responderam: {preview.errors.join(" · ")}</p>
          )}
        </div>
      )}
    </form>
  );
}
