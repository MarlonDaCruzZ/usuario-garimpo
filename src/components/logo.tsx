// Mascote original do Garimpo: cabeça estilizada de arara-canindé.
export function MacawMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#FFC531" />
      {/* corpo / nuca azul */}
      <path d="M14 54c0-17 6-34 22-38 9-2 16 4 16 13 0 5-3 9-7 11l-6 3c-6 3-9 8-10 11z" fill="#0B4FA8" />
      {/* testa verde */}
      <path d="M30 17c4-3 10-3 14 0-4 1-8 3-10 6z" fill="#2DB36A" />
      {/* face branca */}
      <path d="M38 22c5 0 9 4 9 8s-3 7-7 7c-4 0-7-3-7-7 0-5 2-8 5-8z" fill="#fff" />
      <path d="M36 32c2 1 5 1 7 0M36 29c2 1 4 1 6 0" stroke="#0E1B33" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".5" />
      {/* olho */}
      <circle cx="40" cy="26" r="2.6" fill="#0E1B33" />
      <circle cx="40.8" cy="25.2" r=".8" fill="#fff" />
      {/* bico curvo */}
      <path d="M46 26c6 0 10 5 9 11-1 4-4 6-7 6 2-3 2-6 0-8-1-2-3-3-5-3z" fill="#0E1B33" />
      {/* peito amarelo */}
      <path d="M33 41c3 2 7 2 10 1-3 5-7 9-13 12 0-5 1-9 3-13z" fill="#FFE07A" />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <MacawMark size={size} />
      <span className="font-display text-2xl font-extrabold tracking-tight text-arara-900">
        Garimpo<span className="text-sol-500">.</span>
      </span>
    </span>
  );
}
