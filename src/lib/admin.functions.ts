import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleSchema = z.enum(["admin", "garcom", "cozinha", "caixa"]);

const getSupabaseAdmin = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
};

const requireAdmin = async (userId: string, empresaId: string) => {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("empresa_id", empresaId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas administradores");
};

const getAdminEmpresaId = async (userId: string) => {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.empresa_id) throw new Error("Empresa do administrador não encontrada");
  return data.empresa_id;
};

const assertUserInEmpresa = async (userId: string, empresaId: string) => {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário não pertence à sua empresa");
};

export const criarMembroEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        senha: z.string().min(6).max(72),
        nome: z.string().min(1).max(120),
        telefone: z.string().max(40).optional().nullable(),
        role: RoleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const empresaId = await getAdminEmpresaId(context.userId);
    await requireAdmin(context.userId, empresaId);

    let { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
      app_metadata: { invited_by_empresa: empresaId, initial_role: data.role },
    });

    if (error?.message?.includes("Database error checking email")) {
      await supabaseAdmin.rpc("reparar_identidade_auth_orfa_por_email", { _email: data.email });

      const retry = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.senha,
        email_confirm: true,
        user_metadata: { nome: data.nome },
        app_metadata: { invited_by_empresa: empresaId, initial_role: data.role },
      });

      created = retry.data;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    // handle_new_user já cria profile + role 'garcom' (ou admin se 1º).
    // Atualiza telefone e ajusta role para a desejada.
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: uid, nome: data.nome, telefone: data.telefone ?? null, empresa_id: empresaId });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role, empresa_id: empresaId });

    return { ok: true, id: uid };
  });

export const atualizarMembroEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        nome: z.string().min(1).max(120).optional(),
        telefone: z.string().max(40).optional().nullable(),
        ativo: z.boolean().optional(),
        role: RoleSchema.optional(),
        novaSenha: z.string().min(6).max(72).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const empresaId = await getAdminEmpresaId(context.userId);
    await requireAdmin(context.userId, empresaId);
    await assertUserInEmpresa(data.userId, empresaId);

    if (data.nome || data.telefone !== undefined || data.ativo !== undefined) {
      const update: { nome?: string; telefone?: string | null; ativo?: boolean } = {};
      if (data.nome) update.nome = data.nome;
      if (data.telefone !== undefined) update.telefone = data.telefone;
      if (data.ativo !== undefined) update.ativo = data.ativo;
      await supabaseAdmin.from("profiles").update(update).eq("id", data.userId);
    }
    if (data.role) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("empresa_id", empresaId);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role, empresa_id: empresaId });
    }
    if (data.novaSenha) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.novaSenha,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listarMembrosEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const empresaId = await getAdminEmpresaId(context.userId);
    await requireAdmin(context.userId, empresaId);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, telefone, ativo, created_at")
      .eq("empresa_id", empresaId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("empresa_id", empresaId);
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 200,
    });

    const emails = new Map(users.users.map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      ativo: p.ativo,
      email: emails.get(p.id) ?? "",
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const excluirMembroEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getSupabaseAdmin();
    const empresaId = await getAdminEmpresaId(context.userId);
    await requireAdmin(context.userId, empresaId);
    await assertUserInEmpresa(data.userId, empresaId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a si mesmo");
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("empresa_id", empresaId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
