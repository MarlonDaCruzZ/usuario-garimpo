import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/supabase/server";
import { signOut, updateProfile } from "../radar/actions";

export default async function ContaPage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Conta</h1>
        <form action={updateProfile} className="card mt-6 space-y-4 p-6">
          <div>
            <label className="label" htmlFor="display_name">Nome</label>
            <input id="display_name" name="display_name" defaultValue={p?.display_name ?? ""} className="input" />
          </div>
          <div>
            <span className="label">E-mail</span>
            <p className="text-sm">{user.email}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="email_alerts" defaultChecked={p?.email_alerts} className="h-4 w-4 accent-arara-700" />
            Receber alertas de preço por e-mail
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="daily_digest" defaultChecked={p?.daily_digest} className="h-4 w-4 accent-arara-700" />
            Receber resumo diário às 8h
          </label>
          <button className="btn-primary">Salvar</button>
        </form>
        <form action={signOut} className="mt-4">
          <button className="btn-ghost">Sair da conta</button>
        </form>
      </main>
    </>
  );
}
