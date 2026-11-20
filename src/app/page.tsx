import Link from "next/link";
import { BellRing, Radar, Store, TrendingDown } from "lucide-react";
import { Header } from "@/components/header";
import { MacawMark } from "@/components/logo";

const steps = [
  { icon: Radar, title: "Coloque no radar", text: "Digite o nome do produto ou cole o link de um anúncio." },
  { icon: Store, title: "A gente garimpa", text: "Google Shopping, KaBuM!, Mercado Livre e a página que você colou, a cada 6 horas." },
  { icon: BellRing, title: "Você é avisado", text: "E-mail quando bater o preço-alvo, cair X% ou chegar no menor preço já visto." },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-arara-700 text-white">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sol-500/20 blur-3xl" />
          <div className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-mata-500/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 md:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="inline-block rounded-full bg-sol-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-arara-900">
                Grátis
              </span>
              <h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.05] md:text-6xl">
                Pare de caçar promoção.<br />
                <span className="text-sol-500">Deixa que a arara garimpa.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-arara-100">
                Monte seu radar de compras e receba um aviso quando o preço do que você quer despencar.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login?modo=cadastro" className="btn-sol px-6 py-3 text-base">Criar meu radar</Link>
                <Link href="/login" className="btn px-6 py-3 text-base text-white ring-1 ring-white/30 hover:bg-white/10">Já tenho conta</Link>
              </div>
            </div>
            <div className="hidden justify-center md:flex">
              <div className="relative">
                <MacawMark size={260} className="drop-shadow-2xl" />
                <div className="absolute -bottom-4 -left-10 rotate-[-6deg] rounded-2xl bg-white px-4 py-3 text-arara-900 shadow-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-mata-700"><TrendingDown size={14} /> caiu 18%</div>
                  <div className="font-display text-2xl font-extrabold">R$ 1.899,99</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="font-display text-3xl font-extrabold">Como funciona</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sol-100 text-arara-700">
                  <Icon size={22} />
                </div>
                <div className="mt-4 text-xs font-extrabold text-sol-600">PASSO {i + 1}</div>
                <h3 className="font-display text-xl font-bold">{title}</h3>
                <p className="mt-1 text-sm text-arara-900/70">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-arara-100 py-6 text-center text-xs text-arara-900/60">
        Garimpo · preços coletados automaticamente; confira sempre na loja antes de comprar. Alguns links podem ser de afiliado.
      </footer>
    </>
  );
}
