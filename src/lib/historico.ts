import { supabase } from "@/integrations/supabase/client";

export type HistoricoAcao =
  | "comanda_aberta"
  | "itens_adicionados"
  | "item_cancelado"
  | "item_editado"
  | "pagamento_registrado"
  | "desconto_aplicado"
  | "acrescimo_aplicado"
  | "fechamento_solicitado"
  | "comanda_fechada"
  | "comanda_reaberta"
  | "comanda_cancelada"
  | "cliente_alterado"
  | "transferida"
  | "juntada";

export async function logHistorico(p: {
  comanda_id: string;
  usuario_id?: string | null;
  usuario_nome?: string | null;
  acao: HistoricoAcao;
  detalhes?: Record<string, unknown> | string | null;
  valor?: number | null;
}) {
  const det = typeof p.detalhes === "string" ? { texto: p.detalhes } : (p.detalhes ?? null);
  await supabase.from("comanda_historico").insert({
    comanda_id: p.comanda_id,
    usuario_id: p.usuario_id ?? null,
    usuario_nome: p.usuario_nome ?? null,
    acao: p.acao,
    detalhes: det as unknown as never,
    valor: p.valor ?? null,
  });
}

export const acaoLabel: Record<HistoricoAcao, string> = {
  comanda_aberta: "Comanda aberta",
  itens_adicionados: "Itens adicionados",
  item_cancelado: "Item cancelado",
  item_editado: "Item editado",
  pagamento_registrado: "Pagamento registrado",
  desconto_aplicado: "Desconto aplicado",
  acrescimo_aplicado: "Acréscimo aplicado",
  fechamento_solicitado: "Fechamento solicitado",
  comanda_fechada: "Comanda fechada",
  comanda_reaberta: "Comanda reaberta",
  comanda_cancelada: "Comanda cancelada",
  cliente_alterado: "Cliente alterado",
  transferida: "Comanda transferida",
  juntada: "Comandas unidas",
};
