"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { splitWords, toNum } from "@/lib/format";

export type PreviewOffer = { store: string; title: string; price: number; url: string; image?: string | null };
export type PreviewResult = { offers: PreviewOffer[]; errors: string[]; error?: string };

async function callFunction(body: Record<string, unknown>) {
  const { supabase, user } = await requireUser();
  if (!user) throw new Error("Faça login de novo");
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/garimpo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session?.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export async function previewSearch(input: {
  query?: string; url?: string; must_include?: string[]; must_exclude?: string[]; min_price?: number | null;
}): Promise<PreviewResult> {
  try {
    const r = await callFunction({ action: "preview", ...input });
    if (r.error) return { offers: [], errors: [], error: r.error };
    return { offers: r.offers ?? [], errors: r.errors ?? [] };
  } catch (e) {
    return { offers: [], errors: [], error: (e as Error).message };
  }
}

export async function addItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const kind = formData.get("kind") === "url" ? "url" : "query";
  const query = String(formData.get("query") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || (kind === "query" ? query : "Produto");

  const { data, error } = await supabase.from("radar_items").insert({
    user_id: user.id,
    kind,
    title: title.slice(0, 120),
    query: kind === "query" ? query : null,
    url: kind === "url" ? url : null,
    must_include: splitWords(formData.get("must_include")),
    must_exclude: splitWords(formData.get("must_exclude")),
    min_price: toNum(formData.get("min_price")),
    target_price: toNum(formData.get("target_price")),
    drop_pct: toNum(formData.get("drop_pct")) ?? 10,
  }).select("id").single();

  if (error) redirect(`/radar?erro=${encodeURIComponent(error.message)}`);
  await callFunction({ action: "check_item", item_id: data.id }).catch(() => null);
  revalidatePath("/radar");
  redirect(`/radar/${data.id}`);
}

export async function updateItem(id: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  await supabase.from("radar_items").update({
    title: String(formData.get("title") ?? "").trim().slice(0, 120) || undefined,
    must_include: splitWords(formData.get("must_include")),
    must_exclude: splitWords(formData.get("must_exclude")),
    min_price: toNum(formData.get("min_price")),
    target_price: toNum(formData.get("target_price")),
    drop_pct: toNum(formData.get("drop_pct")) ?? 10,
    notify_target: formData.get("notify_target") === "on",
    notify_drop: formData.get("notify_drop") === "on",
    notify_low: formData.get("notify_low") === "on",
    active: formData.get("active") === "on",
  }).eq("id", id);
  revalidatePath(`/radar/${id}`);
  revalidatePath("/radar");
}

export async function checkNow(id: string) {
  await callFunction({ action: "check_item", item_id: id });
  revalidatePath(`/radar/${id}`);
  revalidatePath("/radar");
}

export async function deleteItem(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  await supabase.from("radar_items").delete().eq("id", id);
  revalidatePath("/radar");
  redirect("/radar");
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  await supabase.from("profiles").update({
    display_name: String(formData.get("display_name") ?? "").trim() || null,
    email_alerts: formData.get("email_alerts") === "on",
    daily_digest: formData.get("daily_digest") === "on",
  }).eq("id", user.id);
  revalidatePath("/conta");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/");
}
