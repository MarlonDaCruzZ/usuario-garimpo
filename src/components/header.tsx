import Link from "next/link";
import { Logo } from "./logo";
import { requireUser } from "@/lib/supabase/server";

export async function Header() {
  const { user } = await requireUser();
  return (
    <header className="sticky top-0 z-20 border-b border-arara-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={user ? "/radar" : "/"}><Logo size={34} /></Link>
        <nav className="flex items-center gap-1">
          {user ? (
            <>
              <Link href="/radar" className="btn-ghost">Meu radar</Link>
              <Link href="/conta" className="btn-ghost">Conta</Link>
            </>
          ) : (
            <Link href="/login" className="btn-primary">Entrar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
