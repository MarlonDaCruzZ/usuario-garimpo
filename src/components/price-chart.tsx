import { brl } from "@/lib/format";

type Point = { price: number; checked_at: string };

// Gráfico simples em SVG (sem biblioteca) do melhor preço por checagem.
export function PriceChart({ points, target }: { points: Point[]; target?: number | null }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-arara-900/60">O gráfico aparece depois da segunda checagem.</p>;
  }
  const W = 640, H = 200, P = 28;
  const prices = points.map((p) => Number(p.price));
  const lo = Math.min(...prices, target ?? Infinity), hi = Math.max(...prices, target ?? -Infinity);
  const span = hi - lo || 1;
  const t0 = new Date(points[0].checked_at).getTime();
  const t1 = new Date(points[points.length - 1].checked_at).getTime() || t0 + 1;
  const x = (iso: string) => P + ((new Date(iso).getTime() - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.checked_at).toFixed(1)},${y(Number(p.price)).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points[points.length - 1].checked_at)},${H - P} L${P},${H - P} Z`;
  const minI = prices.indexOf(Math.min(...prices));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Histórico de preço">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1E6AD0" stopOpacity=".25" />
          <stop offset="1" stopColor="#1E6AD0" stopOpacity="0" />
        </linearGradient>
      </defs>
      {target ? (
        <>
          <line x1={P} x2={W - P} y1={y(target)} y2={y(target)} stroke="#E8A800" strokeDasharray="5 5" />
          <text x={W - P} y={y(target) - 6} textAnchor="end" fontSize="11" fill="#B88400" fontWeight="bold">alvo {brl(target)}</text>
        </>
      ) : null}
      <path d={area} fill="url(#g)" />
      <path d={line} fill="none" stroke="#0B4FA8" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(points[minI].checked_at)} cy={y(prices[minI])} r="5" fill="#FFC531" stroke="#0B4FA8" strokeWidth="2" />
      <text x={P} y={14} fontSize="11" fill="#5B6B85">{brl(hi)}</text>
      <text x={P} y={H - 8} fontSize="11" fill="#5B6B85">{brl(lo)}</text>
    </svg>
  );
}
