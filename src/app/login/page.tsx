"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"entrar" | "cadastro">(params.get("modo") === "cadastro" ? "cadastro" : "entrar");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "erro" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const supabase = createClient();
    if (mode === "cadastro") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback`, data: { name: fd.get("name") } },
      });
      if (error) setMsg({ type: "erro", text: traduz(error.message) });
      else if (!data.session) setMsg({ type: "ok", text: "Conta criada! Confirme pelo link que enviamos ao seu e-mail." });
      else router.push("/radar");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "erro", text: traduz(error.message) });
      else {
        const next = params.get("next") ?? "";
        router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/radar");
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <div className="card w-full max-w-md p-8">
      <Link href="/"><Logo /></Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold">
        {mode === "cadastro" ? "Crie seu radar" : "Bem-vindo de volta"}
      </h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "cadastro" && (
          <div><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="input" /></div>
        )}
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" minLength={6} required className="input" /></div>
        {msg && (
          <p className={`rounded-xl px-3 py-2 text-sm ${msg.type === "erro" ? "bg-red-50 text-red-700" : "bg-mata-500/10 text-mata-700"}`}>{msg.text}</p>
        )}
        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Aguarde…" : mode === "cadastro" ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <button
        onClick={() => { setMode(mode === "cadastro" ? "entrar" : "cadastro"); setMsg(null); }}
        className="mt-4 w-full text-center text-sm font-bold text-arara-700 hover:underline"
      >
        {mode === "cadastro" ? "Já tenho conta" : "Ainda não tenho conta"}
      </button>
    </div>
  );
}

function traduz(m: string) {
  if (/invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(m)) return "Esse e-mail já tem conta. Tente entrar.";
  if (/email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar.";
  if (/rate limit/i.test(m)) return "Muitas tentativas. Espere alguns minutos.";
  return m;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-arara-700 to-arara-800 p-4">
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
