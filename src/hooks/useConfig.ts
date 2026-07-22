import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/lib/realtime";

export type HorarioDia = { abre: string; fecha: string; aberto: boolean };
export type HorariosSemana = Record<
  "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab",
  HorarioDia
>;

export type AppConfig = {
  id: string;
  modo_operacao: "mesas" | "comandas" | "ambos";
  taxa_garcom_ativa: boolean;
  taxa_garcom_percentual: number;
  taxa_garcom_auto: boolean;
  couvert_ativo: boolean;
  couvert_valor: number;
  horario_ativo: boolean;
  horarios: HorariosSemana;
  pin_diario_ativo: boolean;
};

let _cache: AppConfig | null = null;
const _subs = new Set<(c: AppConfig | null) => void>();

export function resetConfigCache() {
  _cache = null;
  _subs.forEach((fn) => fn(null));
}

async function refetch() {
  const { data } = await (
    supabase as unknown as { rpc: (n: string) => Promise<{ data: AppConfig[] | null }> }
  ).rpc("get_configuracoes_publicas");
  _cache = (Array.isArray(data) ? data[0] : null) ?? null;
  _subs.forEach((fn) => fn(_cache));
}

export function useConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(_cache);
  useEffect(() => {
    _subs.add(setCfg);
    void refetch();
    return () => {
      _subs.delete(setCfg);
    };
  }, []);
  useRealtime(["configuracoes"], () => {
    void refetch();
  });
  return cfg;
}
