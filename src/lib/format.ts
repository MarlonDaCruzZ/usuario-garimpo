export const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function timeAgo(iso: string | null) {
  if (!iso) return "ainda não checado";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)} dias`;
}

export const splitWords = (s: FormDataEntryValue | null) =>
  String(s ?? "").split(",").map((w) => w.trim()).filter(Boolean);

export const toNum = (s: FormDataEntryValue | null) => {
  let v = String(s ?? "").replace(/[^\d.,]/g, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};
