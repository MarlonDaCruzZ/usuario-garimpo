// E-mails do Garimpo via Resend (azul + amarelo arara-canindé)

const BLUE = "#0B4FA8";
const YELLOW = "#FFC531";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? "Garimpo <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
}

function shell(title: string, body: string) {
  const app = Deno.env.get("APP_URL") ?? "";
  return `<!doctype html><html><body style="margin:0;background:#F3F6FB;font-family:Arial,Helvetica,sans-serif;color:#0E1B33">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:${BLUE};padding:20px 24px;color:#fff;font-size:22px;font-weight:bold">
      Garimpo <span style="color:${YELLOW}">●</span>
      <div style="font-size:13px;font-weight:normal;opacity:.85;margin-top:4px">${title}</div>
    </td></tr>
    <tr><td style="padding:24px">${body}</td></tr>
    <tr><td style="padding:16px 24px;background:#F8FAFD;font-size:12px;color:#5B6B85">
      ${app ? `<a href="${app}/radar" style="color:${BLUE}">Abrir meu radar</a> · ` : ""}Você recebe este e-mail porque tem itens no radar do Garimpo.
    </td></tr>
  </table></td></tr></table></body></html>`;
}

export type AlertLine = {
  itemTitle: string;
  reasons: string[];
  price: number;
  store: string;
  url: string;
  image?: string | null;
};

export function alertEmail(lines: AlertLine[]) {
  const rows = lines.map((l) => `
    <div style="border:1px solid #E3E9F3;border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="font-weight:bold;font-size:16px">${esc(l.itemTitle)}</div>
      <div style="margin:6px 0 10px">${l.reasons.map((r) =>
        `<span style="display:inline-block;background:${YELLOW};color:#0E1B33;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:bold;margin:2px 4px 2px 0">${esc(r)}</span>`).join("")}</div>
      <div style="font-size:26px;font-weight:bold;color:${BLUE}">${brl(l.price)}</div>
      <div style="font-size:13px;color:#5B6B85;margin-bottom:12px">em ${esc(l.store)}</div>
      <a href="${l.url}" style="display:inline-block;background:${BLUE};color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">Ver oferta</a>
    </div>`).join("");
  const subject = lines.length === 1
    ? `${lines[0].itemTitle} por ${brl(lines[0].price)} — ${lines[0].reasons[0]}`
    : `${lines.length} itens do seu radar baixaram de preço`;
  return { subject, html: shell("Achamos uma oferta para você", rows) };
}

export type DigestLine = { title: string; price: number | null; store: string | null; url: string | null; change: number | null; target: number | null };

export function digestEmail(lines: DigestLine[]) {
  const rows = lines.map((l) => {
    const ch = l.change === null || l.change === 0 ? "" :
      l.change < 0
        ? `<span style="color:#0A8F4D;font-weight:bold">▼ ${brl(-l.change)}</span>`
        : `<span style="color:#C0392B">▲ ${brl(l.change)}</span>`;
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #E3E9F3">${esc(l.title)}${l.target ? `<div style="font-size:12px;color:#5B6B85">alvo ${brl(l.target)}</div>` : ""}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E3E9F3;text-align:right;white-space:nowrap">
        ${l.price ? `<a href="${l.url}" style="color:${BLUE};font-weight:bold;text-decoration:none">${brl(l.price)}</a><div style="font-size:12px;color:#5B6B85">${esc(l.store ?? "")} ${ch}</div>` : `<span style="color:#5B6B85">sem ofertas</span>`}
      </td></tr>`;
  }).join("");
  return {
    subject: "Seu resumo diário do Garimpo",
    html: shell("Melhores preços de hoje no seu radar", `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>`),
  };
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
