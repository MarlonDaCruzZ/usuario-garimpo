// Lê segredos: primeiro das variáveis da função (painel do Supabase), depois do Vault do banco.
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const memo = new Map<string, string | null>();

export async function secret(name: string): Promise<string | null> {
  const env = Deno.env.get(name);
  if (env) return env;
  if (memo.has(name)) return memo.get(name)!;
  const { data } = await admin.rpc("garimpo_secret", { secret_name: name.toLowerCase() });
  const value = (data as string | null) ?? null;
  memo.set(name, value);
  return value;
}
