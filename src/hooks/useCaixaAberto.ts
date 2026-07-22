import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/lib/realtime";

export function useCaixaAberto() {
  const [aberto, setAberto] = useState<boolean | null>(null);
  const [caixaId, setCaixaId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("caixas")
      .select("id")
      .eq("status", "aberto")
      .order("aberto_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAberto(!!data);
    setCaixaId((data as { id: string } | null)?.id ?? null);
  };

  useEffect(() => {
    load();
  }, []);
  useRealtime(["caixas"], load, "caixa-aberto-status");

  return { aberto, caixaId, refresh: load };
}
