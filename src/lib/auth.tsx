import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { resetConfigCache } from "@/hooks/useConfig";

export type AppRole = "admin" | "garcom" | "cozinha" | "caixa";

export type EmpresaInfo = {
  id: string;
  nome: string;
  onboarding_completo: boolean;
  onboarding_etapa: number;
} | null;

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  nome: string | null;
  empresa: EmpresaInfo;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (args: {
    email: string;
    password: string;
    nome: string;
    nomeEmpresa: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshEmpresa: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [nome, setNome] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaInfo>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("nome, empresa_id").eq("id", uid).maybeSingle(),
    ]);
    setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
    setNome(p?.nome ?? null);
    const empresaId = (p as { empresa_id?: string } | null)?.empresa_id;
    if (empresaId) {
      const { data: e } = await supabase
        .from("empresas")
        .select("id, nome, onboarding_completo, onboarding_etapa")
        .eq("id", empresaId)
        .maybeSingle();
      setEmpresa(e as EmpresaInfo);
    } else {
      setEmpresa(null);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        resetConfigCache();
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        resetConfigCache();
        setRoles([]);
        setNome(null);
        setEmpresa(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async ({
    email,
    password,
    nome,
    nomeEmpresa,
  }: {
    email: string;
    password: string;
    nome: string;
    nomeEmpresa: string;
  }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { nome, nome_empresa: nomeEmpresa },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };
  const refreshEmpresa = refreshRoles;

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        nome,
        empresa,
        loading,
        signIn,
        signUp,
        signOut,
        refreshRoles,
        refreshEmpresa,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fora do AuthProvider");
  return v;
}

export const hasRole = (roles: AppRole[], r: AppRole) =>
  roles.includes(r) || roles.includes("admin");
