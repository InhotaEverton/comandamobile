import { readFileSync } from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

try {
  for (const raw of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const line = raw.trim(),
      i = line.indexOf("=");
    if (!line || line.startsWith("#") || i < 1) continue;
    const key = line.slice(0, i).trim();
    const value = line
      .slice(i + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !secret) {
  console.error("Defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const stamp = `${Date.now()}-${process.pid}`;
const password = `Rls!${stamp}Aa#`;
const users = [],
  companies = [],
  checks = [];
const tables = [
  "adicionais",
  "bairros_entrega",
  "caixas",
  "categorias",
  "clientes_online",
  "comanda_historico",
  "comandas",
  "configuracoes",
  "grupos_adicionais",
  "itens_pedido",
  "itens_pedido_adicionais",
  "mesas",
  "movimentacoes_caixa",
  "pagamentos",
  "pedidos",
  "pin_diario",
  "produto_grupos_adicionais",
  "produtos",
  "profiles",
  "user_roles",
];

const check = (name, passed, detail = "") => checks.push({ name, passed, detail });
function dataOf(response, context) {
  if (response.error) throw new Error(`${context}: ${response.error.message}`);
  return response.data;
}

async function createTenant(index) {
  const email = `rls-audit-${stamp}-${index}@example.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: `RLS Audit ${index}`, nome_empresa: `RLS Audit ${stamp} ${index}` },
  });
  if (created.error) throw created.error;
  const user = { id: created.data.user.id, email };
  users.push(user);
  const profile = dataOf(
    await admin.from("profiles").select("empresa_id").eq("id", user.id).single(),
    "perfil temporário",
  );
  companies.push(profile.empresa_id);
  return user;
}

async function cleanup() {
  const errors = [];
  if (companies.length) {
    const removed = await admin.from("empresas").delete().in("id", companies);
    if (removed.error) errors.push(removed.error.message);
  }
  for (const user of users) {
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) errors.push(removed.error.message);
  }
  if (errors.length) throw new Error(`Falha na limpeza: ${errors.join("; ")}`);
}

async function main() {
  let cleanupError;
  try {
    const userA = await createTenant(0),
      userB = await createTenant(1);
    const [companyA, companyB] = companies;
    const sentinel = dataOf(
      await admin
        .from("categorias")
        .insert({ nome: `Categoria B ${stamp}`, empresa_id: companyB })
        .select("id,nome")
        .single(),
      "dado sentinela",
    );
    const a = createClient(url, publicKey, options);
    const login = await a.auth.signInWithPassword({ email: userA.email, password });
    if (login.error) throw login.error;

    let r = await a.from("empresas").select("id").eq("id", companyB);
    check(
      "empresas: SELECT cruzado bloqueado",
      !r.error && r.data.length === 0,
      r.error?.message || `linhas=${r.data.length}`,
    );
    for (const table of tables) {
      r = await a.from(table).select("empresa_id").eq("empresa_id", companyB);
      check(
        `${table}: SELECT cruzado bloqueado`,
        !r.error && r.data.length === 0,
        r.error?.message || `linhas=${r.data.length}`,
      );
    }

    r = await a.from("profiles").update({ empresa_id: companyB }).eq("id", userA.id).select();
    check(
      "troca do próprio tenant bloqueada",
      Boolean(r.error),
      r.error?.message || "alteração aceita",
    );
    const own = dataOf(
      await admin.from("profiles").select("empresa_id").eq("id", userA.id).single(),
      "tenant original",
    );
    check("tenant original permaneceu intacto", own.empresa_id === companyA);

    r = await a.rpc("get_empresa_id_do_usuario", { _user_id: userB.id });
    check(
      "helper não revela tenant alheio",
      !r.error && r.data === null,
      r.error?.message || String(r.data),
    );
    r = await a
      .from("user_roles")
      .insert({ user_id: userB.id, role: "admin", empresa_id: companyA });
    check(
      "injeção de papel cruzado bloqueada",
      Boolean(r.error),
      r.error?.message || "papel aceito",
    );
    r = await a.from("categorias").insert({ nome: `Invasão ${stamp}`, empresa_id: companyB });
    check("INSERT cruzado bloqueado", Boolean(r.error), r.error?.message || "inserção aceita");
    r = await a
      .from("categorias")
      .update({ nome: `Alterada ${stamp}` })
      .eq("id", sentinel.id)
      .select("id");
    check(
      "UPDATE cruzado bloqueado",
      !r.error && r.data.length === 0,
      r.error?.message || `linhas=${r.data.length}`,
    );
    r = await a.from("categorias").delete().eq("id", sentinel.id).select("id");
    check(
      "DELETE cruzado bloqueado",
      !r.error && r.data.length === 0,
      r.error?.message || `linhas=${r.data.length}`,
    );
    const unchanged = dataOf(
      await admin.from("categorias").select("nome").eq("id", sentinel.id).single(),
      "sentinela",
    );
    check("dado da outra empresa permaneceu intacto", unchanged.nome === sentinel.nome);
    r = await a.rpc("reparar_identidade_auth_orfa_por_email", { _email: "nobody@example.invalid" });
    check("RPC administrativa bloqueada", Boolean(r.error), r.error?.message || "RPC aceita");
  } finally {
    try {
      await cleanup();
    } catch (error) {
      cleanupError = error;
    }
  }

  const failed = checks.filter((item) => !item.passed);
  for (const item of checks)
    console.log(
      `${item.passed ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` — ${item.detail}` : ""}`,
    );
  console.log(
    `\nRLS multiempresa: ${checks.length - failed.length}/${checks.length} verificações passaram.`,
  );
  if (cleanupError) throw cleanupError;
  if (failed.length) throw new Error(`${failed.length} verificação(ões) falharam.`);
}

main().catch((error) => {
  console.error(`\nERRO: ${error.message || error}`);
  process.exitCode = 1;
});
