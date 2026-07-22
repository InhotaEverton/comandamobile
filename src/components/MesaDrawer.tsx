import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { brl, timeAgo } from "@/lib/format";
import { logHistorico, acaoLabel, type HistoricoAcao } from "@/lib/historico";
import { AddItemsModal } from "@/components/AddItemsModal";
import { useCaixaAberto } from "@/hooks/useCaixaAberto";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  ArrowRightLeft,
  Merge,
  Wallet,
  Percent,
  PlusCircle,
  Printer,
  Bell,
  Receipt,
  Trash2,
  Loader2,
  History,
  Ban,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { printTicketWindow } from "@/components/PrintTicket";
import { PersonalizacaoModal, type AdicionalEscolhido } from "@/components/PersonalizacaoModal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as any;

type Mesa = {
  id: string;
  numero: number;
  lugares: number;
  setor: string | null;
  status: "livre" | "ocupada" | "fechando";
};
type Comanda = {
  id: string;
  mesa_id: string | null;
  total: number;
  aberta_em: string;
  status: string;
  garcom_id: string;
  desconto: number;
  acrescimo: number;
  cliente_nome: string | null;
  observacao: string | null;
  fechada_em: string | null;
  cancelada_em: string | null;
  taxa_servico: number;
  couvert_valor: number;
  couvert_pessoas: number;
};
type Configuracoes = {
  taxa_garcom_ativa: boolean;
  taxa_garcom_percentual: number;
  taxa_garcom_auto: boolean;
  couvert_ativo: boolean;
  couvert_valor: number;
};
type Pedido = { id: string; status: string; setor: string; total: number; created_at: string };
type Item = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  preco_unit: number;
  observacao: string | null;
  subtotal: number;
  cancelado: boolean;
  motivo_cancelamento: string | null;
};
type Pagamento = {
  id: string;
  forma: string;
  valor: number;
  cliente_nome: string | null;
  created_at: string;
};
type HistoricoRow = {
  id: string;
  comanda_id: string;
  usuario_nome: string | null;
  acao: HistoricoAcao;
  detalhes: Record<string, unknown> | null;
  valor: number | null;
  created_at: string;
};

interface Props {
  mesa: Mesa | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAS = ["pix", "dinheiro", "credito", "debito"] as const;
type Forma = (typeof FORMAS)[number];

export function MesaDrawer({ mesa, open, onOpenChange }: Props) {
  const { user, roles, nome: userNome } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCaixa = roles.includes("caixa");
  const canFinanceiro = isAdmin || isCaixa; // descontos, recebimentos, fechar
  const { aberto: caixaAberto } = useCaixaAberto();

  const canCancel = isAdmin; // cancelar itens e comanda — somente admin

  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [adicionaisMap, setAdicionaisMap] = useState<
    Record<string, { nome: string; preco: number; grupo_nome: string | null }[]>
  >({});
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [garcomNome, setGarcomNome] = useState<string>("");
  const [outrasMesas, setOutrasMesas] = useState<Mesa[]>([]);
  const [outrasComandas, setOutrasComandas] = useState<
    Record<string, { cliente_nome: string | null; codigo?: string | null }>
  >({});
  const [config, setConfig] = useState<Configuracoes | null>(null);
  const [loading, setLoading] = useState(false);

  // dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editCliente, setEditCliente] = useState(false);
  const [clienteInput, setClienteInput] = useState("");
  const [descontoOpen, setDescontoOpen] = useState(false);
  const [descontoTipo, setDescontoTipo] = useState<"desconto" | "acrescimo">("desconto");
  const [descontoModo, setDescontoModo] = useState<"valor" | "percent">("valor");
  const [descontoInput, setDescontoInput] = useState("");
  const [parcialOpen, setParcialOpen] = useState(false);
  const [parcialForma, setParcialForma] = useState<Forma>("pix");
  const [parcialValor, setParcialValor] = useState("");
  const [parcialCliente, setParcialCliente] = useState("");
  const [fecharAposPagar, setFecharAposPagar] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [juntarOpen, setJuntarOpen] = useState(false);
  const [juntarFrom, setJuntarFrom] = useState("");

  const [cancelItem, setCancelItem] = useState<Item | null>(null);
  const [cancelItemMotivo, setCancelItemMotivo] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editItemQtd, setEditItemQtd] = useState("1");
  const [editItemObs, setEditItemObs] = useState("");
  const [editAdicionaisFor, setEditAdicionaisFor] = useState<Item | null>(null);
  const [editProdutoBase, setEditProdutoBase] = useState<{
    id: string;
    nome: string;
    preco: number;
  } | null>(null);
  const [cancelComandaOpen, setCancelComandaOpen] = useState(false);
  const [cancelComandaMotivo, setCancelComandaMotivo] = useState("");
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState("");

  const userLabel = userNome ?? user?.email ?? null;

  const carregar = async () => {
    if (!mesa) return;
    setLoading(true);
    // pega a comanda mais recente da mesa (aberta, fechando, fechada ou cancelada)
    const { data: c } = await supabase
      .from("comandas")
      .select("*")
      .eq("mesa_id", mesa.id)
      .in("status", ["aberta", "fechando", "fechada", "cancelada"])
      .order("aberta_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    setComanda(c as Comanda | null);

    if (c) {
      const [{ data: peds }, { data: pag }, { data: prof }, { data: hist }] = await Promise.all([
        supabase.from("pedidos").select("*").eq("comanda_id", c.id).order("created_at"),
        supabase.from("pagamentos").select("*").eq("comanda_id", c.id).order("created_at"),
        c.garcom_id
          ? supabase.from("profiles").select("nome").eq("id", c.garcom_id).maybeSingle()
          : Promise.resolve({ data: null as { nome: string } | null }),
        supabase
          .from("comanda_historico")
          .select("*")
          .eq("comanda_id", c.id)
          .order("created_at", { ascending: false }),
      ]);

      setPedidos((peds ?? []) as Pedido[]);
      setPagamentos((pag ?? []) as Pagamento[]);
      setGarcomNome(prof?.nome ?? "");
      setHistorico((hist ?? []) as HistoricoRow[]);
      const ids = (peds ?? []).map((p: Pedido) => p.id);
      if (ids.length) {
        const { data: its } = await supabase.from("itens_pedido").select("*").in("pedido_id", ids);
        const itensList = (its ?? []) as Item[];
        setItens(itensList);
        const itemIds = itensList.map((i) => i.id);
        if (itemIds.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: adics } = await (supabase as any)
            .from("itens_pedido_adicionais")
            .select("item_pedido_id,adicional_nome,grupo_nome,preco")
            .in("item_pedido_id", itemIds);
          const map: Record<string, { nome: string; preco: number; grupo_nome: string | null }[]> =
            {};
          (adics ?? []).forEach(
            (a: {
              item_pedido_id: string;
              adicional_nome: string;
              grupo_nome: string | null;
              preco: number;
            }) => {
              (map[a.item_pedido_id] ||= []).push({
                nome: a.adicional_nome,
                preco: Number(a.preco),
                grupo_nome: a.grupo_nome,
              });
            },
          );
          setAdicionaisMap(map);
        } else setAdicionaisMap({});
      } else {
        setItens([]);
        setAdicionaisMap({});
      }
    } else {
      setPedidos([]);
      setItens([]);
      setAdicionaisMap({});
      setPagamentos([]);
      setGarcomNome("");
      setHistorico([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !mesa) return;
    carregar();
    supabase
      .from("mesas")
      .select("*")
      .neq("id", mesa.id)
      .order("numero")
      .then(({ data }) => setOutrasMesas((data ?? []) as Mesa[]));
    supabase
      .from("comandas")
      .select("mesa_id,cliente_nome,codigo")
      .eq("status", "aberta")
      .neq("mesa_id", mesa.id)
      .then(({ data }) => {
        const map: Record<string, { cliente_nome: string | null; codigo?: string | null }> = {};
        (data ?? []).forEach(
          (c: { mesa_id: string | null; cliente_nome: string | null; codigo?: string | null }) => {
            if (c.mesa_id) map[c.mesa_id] = { cliente_nome: c.cliente_nome, codigo: c.codigo };
          },
        );
        setOutrasComandas(map);
      });
    (supabase as unknown as { rpc: (n: string) => Promise<{ data: Configuracoes[] | null }> })
      .rpc("get_configuracoes_publicas")
      .then(({ data }) => setConfig(Array.isArray(data) ? (data[0] ?? null) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mesa?.id]);

  useRealtime(
    [
      "comandas",
      "pedidos",
      "itens_pedido",
      "itens_pedido_adicionais",
      "pagamentos",
      "comanda_historico",
    ],
    () => {
      if (open) carregar();
    },
    `drawer-${mesa?.id ?? "none"}`,
  );

  const itensValidos = useMemo(
    () =>
      itens.filter(
        (i) => !i.cancelado && pedidos.find((p) => p.id === i.pedido_id)?.status !== "cancelado",
      ),
    [itens, pedidos],
  );
  const itensCancelados = useMemo(() => itens.filter((i) => i.cancelado), [itens]);

  const totalItens = itensValidos.reduce((s, i) => s + Number(i.subtotal), 0);
  const pagoTotal = pagamentos.reduce((s, p) => s + Number(p.valor), 0);
  const taxaServico = Number(comanda?.taxa_servico ?? 0);
  const couvertTotal = Number(comanda?.couvert_valor ?? 0) * Number(comanda?.couvert_pessoas ?? 0);
  const totalFinal =
    totalItens -
    Number(comanda?.desconto ?? 0) +
    Number(comanda?.acrescimo ?? 0) +
    taxaServico +
    couvertTotal;
  const restante = Math.max(0, totalFinal - pagoTotal);

  const isAberta = comanda?.status === "aberta" || comanda?.status === "fechando";
  const isFechada = comanda?.status === "fechada";
  const isCancelada = comanda?.status === "cancelada";

  if (!mesa) return null;

  /* ---------- ações ---------- */

  const salvarCliente = async () => {
    if (!comanda) return;
    const antigo = comanda.cliente_nome ?? "";
    await supabase
      .from("comandas")
      .update({ cliente_nome: clienteInput || null })
      .eq("id", comanda.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "cliente_alterado",
      detalhes: { de: antigo, para: clienteInput },
    });
    setEditCliente(false);
    carregar();
  };

  const aplicarDescAcr = async () => {
    if (!comanda) return;
    const raw = Number(descontoInput.replace(",", "."));
    if (isNaN(raw) || raw < 0) {
      toast.error("Valor inválido");
      return;
    }
    const valor = descontoModo === "percent" ? (totalItens * raw) / 100 : raw;
    const update = descontoTipo === "desconto" ? { desconto: valor } : { acrescimo: valor };
    const { error } = await supabase.from("comandas").update(update).eq("id", comanda.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: descontoTipo === "desconto" ? "desconto_aplicado" : "acrescimo_aplicado",
      valor,
      detalhes: { modo: descontoModo, entrada: raw },
    });
    toast.success(`${descontoTipo === "desconto" ? "Desconto" : "Acréscimo"} aplicado`);
    setDescontoOpen(false);
    setDescontoInput("");
    carregar();
  };

  const registrarParcial = async () => {
    if (!comanda || !user) return;
    if (caixaAberto === false) {
      toast.error("Abra o caixa para registrar recebimentos");
      return;
    }
    const v = Number(parcialValor.replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase.from("pagamentos").insert({
      comanda_id: comanda.id,
      forma: parcialForma,
      valor: v,
      cliente_nome: parcialCliente || null,
      registrado_por: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user.id,
      usuario_nome: userLabel,
      acao: "pagamento_registrado",
      valor: v,
      detalhes: { forma: parcialForma, cliente: parcialCliente || null },
    });
    toast.success("Recebimento registrado");
    const novoPago = pagoTotal + v;
    const novoRestante = Math.max(0, totalFinal - novoPago);
    const deveFechar = fecharAposPagar && novoRestante <= 0.01;
    setParcialOpen(false);
    setParcialValor("");
    setParcialCliente("");
    setFecharAposPagar(false);
    await carregar();
    if (deveFechar) await finalizarFechamento();
  };

  const confirmarCancelItem = async () => {
    if (!cancelItem || !comanda) return;
    if (!cancelItemMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    const { error } = await supabase
      .from("itens_pedido")
      .update({
        cancelado: true,
        cancelado_em: new Date().toISOString(),
        cancelado_por: user?.id ?? null,
        motivo_cancelamento: cancelItemMotivo,
      })
      .eq("id", cancelItem.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "item_cancelado",
      detalhes: {
        item: cancelItem.produto_nome,
        qtd: cancelItem.quantidade,
        motivo: cancelItemMotivo,
      },
      valor: Number(cancelItem.subtotal),
    });
    toast.success("Item cancelado");
    setCancelItem(null);
    setCancelItemMotivo("");
    carregar();
  };

  const salvarEditItem = async () => {
    if (!editItem || !comanda) return;
    const q = Math.max(1, Number(editItemQtd) || 1);
    const obs = editItemObs.trim() || null;
    const { error } = await supabase
      .from("itens_pedido")
      .update({
        quantidade: q,
        observacao: obs,
      })
      .eq("id", editItem.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "item_editado",
      detalhes: {
        item: editItem.produto_nome,
        de: { qtd: editItem.quantidade, obs: editItem.observacao },
        para: { qtd: q, obs },
      },
    });
    toast.success("Item atualizado");
    setEditItem(null);
    carregar();
  };

  const abrirEditarAdicionais = async (item: Item) => {
    if (!item.produto_id) {
      toast.error("Item sem produto vinculado");
      return;
    }
    const { data: prod } = await supabase
      .from("produtos")
      .select("id,nome,preco")
      .eq("id", item.produto_id)
      .maybeSingle();
    if (!prod) {
      toast.error("Produto não encontrado");
      return;
    }
    setEditProdutoBase({ id: prod.id, nome: prod.nome, preco: Number(prod.preco) });
    setEditAdicionaisFor(item);
  };

  const salvarAdicionaisEditados = async (payload: {
    adicionais: AdicionalEscolhido[];
    observacao: string;
    quantidade?: number;
  }) => {
    if (!editAdicionaisFor || !editProdutoBase || !comanda) return;
    const item = editAdicionaisFor;
    const novoPrecoUnit =
      editProdutoBase.preco +
      payload.adicionais.reduce((s, a) => s + Number(a.preco) * (a.quantidade ?? 1), 0);
    const { error: delErr } = await sbAny
      .from("itens_pedido_adicionais")
      .delete()
      .eq("item_pedido_id", item.id);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    if (payload.adicionais.length) {
      const empresaId = (await sbAny.rpc("minha_empresa_id")).data;
      const rows = payload.adicionais.map((a) => ({
        empresa_id: empresaId,
        item_pedido_id: item.id,
        adicional_id: a.adicional_id,
        grupo_id: a.grupo_id,
        grupo_nome: a.grupo_nome,
        adicional_nome: a.adicional_nome,
        preco: a.preco,
        quantidade: a.quantidade ?? 1,
      }));
      const { error: insErr } = await sbAny.from("itens_pedido_adicionais").insert(rows);
      if (insErr) {
        toast.error(insErr.message);
        return;
      }
    }
    const novaObs = payload.observacao || item.observacao;
    const { error: upErr } = await supabase
      .from("itens_pedido")
      .update({ preco_unit: novoPrecoUnit, observacao: novaObs })
      .eq("id", item.id);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "item_editado",
      detalhes: {
        item: item.produto_nome,
        adicionais: payload.adicionais.map((a) => a.adicional_nome),
        novo_preco_unit: novoPrecoUnit,
      },
    });
    toast.success("Adicionais atualizados");
    setEditAdicionaisFor(null);
    setEditProdutoBase(null);
    setEditItem(null);
    carregar();
  };

  const solicitarFechamento = async () => {
    if (!comanda) return;
    if (itensValidos.length === 0) {
      toast.error("Não é possível solicitar fechamento sem itens na comanda");
      return;
    }
    await supabase.from("mesas").update({ status: "fechando" }).eq("id", mesa.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "fechamento_solicitado",
    });
    toast.success("Fechamento solicitado");
  };

  const finalizarFechamento = async () => {
    if (!comanda) return;
    await supabase
      .from("comandas")
      .update({
        status: "fechada",
        fechada_em: new Date().toISOString(),
      })
      .eq("id", comanda.id);
    await supabase.from("mesas").update({ status: "livre" }).eq("id", mesa.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "comanda_fechada",
      valor: totalFinal,
    });
    toast.success("Comanda fechada");
    onOpenChange(false);
  };

  const fecharComanda = async () => {
    if (!comanda) return;
    if (caixaAberto === false) {
      toast.error("Abra o caixa para fechar a comanda");
      return;
    }
    if (itensValidos.length === 0) {
      toast.error("Não é possível fechar uma comanda sem itens");
      return;
    }
    // aplica taxa de garçom auto, se configurada e ainda não definida
    if (config?.taxa_garcom_ativa && config.taxa_garcom_auto && !Number(comanda.taxa_servico)) {
      const taxa = (totalItens * Number(config.taxa_garcom_percentual)) / 100;
      await supabase.from("comandas").update({ taxa_servico: taxa }).eq("id", comanda.id);
      await logHistorico({
        comanda_id: comanda.id,
        usuario_id: user?.id,
        usuario_nome: userLabel,
        acao: "acrescimo_aplicado",
        valor: taxa,
        detalhes: { tipo: "taxa_garcom", percentual: config.taxa_garcom_percentual },
      });
      toast.info(`Taxa de garçom de ${brl(taxa)} aplicada`);
      await carregar();
      return; // recalcula e usuário confirma de novo
    }
    if (restante > 0.01) {
      // abre o diálogo de pagamento já preenchido com o valor restante
      setParcialForma("pix");
      setParcialValor(restante.toFixed(2).replace(".", ","));
      setParcialCliente(comanda.cliente_nome ?? "");
      setFecharAposPagar(true);
      setParcialOpen(true);
      toast.info(`Falta ${brl(restante)} — registre o pagamento para fechar`);
      return;
    }
    await finalizarFechamento();
  };

  const aplicarCouvert = async (pessoas: number) => {
    if (!comanda || !config) return;
    await supabase
      .from("comandas")
      .update({
        couvert_pessoas: pessoas,
        couvert_valor: pessoas > 0 ? Number(config.couvert_valor) : 0,
      })
      .eq("id", comanda.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "acrescimo_aplicado",
      valor: pessoas * Number(config.couvert_valor),
      detalhes: { tipo: "couvert", pessoas, valor_unit: config.couvert_valor },
    });
    toast.success(pessoas > 0 ? "Couvert aplicado" : "Couvert removido");
  };

  const confirmarCancelComanda = async () => {
    if (!comanda) return;
    if (!cancelComandaMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    await supabase
      .from("comandas")
      .update({
        status: "cancelada",
        cancelada_em: new Date().toISOString(),
        cancelada_por: user?.id ?? null,
        motivo_cancelamento: cancelComandaMotivo,
      })
      .eq("id", comanda.id);
    await supabase.from("mesas").update({ status: "livre" }).eq("id", mesa.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "comanda_cancelada",
      detalhes: { motivo: cancelComandaMotivo },
    });
    toast.success("Comanda cancelada");
    setCancelComandaOpen(false);
    setCancelComandaMotivo("");
    onOpenChange(false);
  };

  const confirmarReabrir = async () => {
    if (!comanda) return;
    if (!reabrirMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    await supabase
      .from("comandas")
      .update({
        status: "aberta",
        fechada_em: null,
        reaberta_em: new Date().toISOString(),
        reaberta_por: user?.id ?? null,
        motivo_reabertura: reabrirMotivo,
      })
      .eq("id", comanda.id);
    await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesa.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "comanda_reaberta",
      detalhes: { motivo: reabrirMotivo },
    });
    toast.success("Comanda reaberta");
    setReabrirOpen(false);
    setReabrirMotivo("");
    carregar();
  };

  const transferirMesa = async () => {
    if (!comanda || !transferTo) return;
    const destino = outrasMesas.find((m) => m.id === transferTo);
    if (destino?.status !== "livre") {
      toast.error("A mesa de destino precisa estar livre");
      return;
    }
    await supabase.from("comandas").update({ mesa_id: transferTo }).eq("id", comanda.id);
    await supabase.from("mesas").update({ status: "ocupada" }).eq("id", transferTo);
    await supabase.from("mesas").update({ status: "livre" }).eq("id", mesa.id);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "transferida",
      detalhes: { de: mesa.numero, para: destino.numero },
    });
    toast.success(`Comanda movida para mesa ${destino?.numero}`);
    setTransferOpen(false);
    onOpenChange(false);
  };

  const juntarComandas = async () => {
    if (!comanda || !juntarFrom) return;
    const { data: origem } = await supabase
      .from("comandas")
      .select("*")
      .eq("mesa_id", juntarFrom)
      .eq("status", "aberta")
      .maybeSingle();
    if (!origem) {
      toast.error("Mesa de origem não tem comanda aberta");
      return;
    }
    await supabase.from("pedidos").update({ comanda_id: comanda.id }).eq("comanda_id", origem.id);
    await supabase
      .from("pagamentos")
      .update({ comanda_id: comanda.id })
      .eq("comanda_id", origem.id);
    await supabase
      .from("comandas")
      .update({
        status: "fechada",
        fechada_em: new Date().toISOString(),
      })
      .eq("id", origem.id);
    await supabase.from("mesas").update({ status: "livre" }).eq("id", juntarFrom);
    await logHistorico({
      comanda_id: comanda.id,
      usuario_id: user?.id,
      usuario_nome: userLabel,
      acao: "juntada",
      detalhes: { origem_comanda: origem.id },
    });
    toast.success("Comandas unidas");
    setJuntarOpen(false);
    carregar();
  };

  const imprimirPreConta = () => {
    if (!comanda) return;
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const linhas = itensValidos
      .map((i) => {
        const adics = adicionaisMap[i.id] ?? [];
        return (
          `<div style="display:flex;justify-content:space-between"><span>${esc(i.quantidade)}x ${esc(i.produto_nome)}</span><span>${esc(brl(i.subtotal))}</span></div>` +
          adics
            .map(
              (a) =>
                `<div style="padding-left:8px">+ ${esc(a.nome)}${a.preco > 0 ? ` (${esc(brl(a.preco))})` : ""}</div>`,
            )
            .join("") +
          (i.observacao ? `<div style="font-style:italic">  &gt; ${esc(i.observacao)}</div>` : "")
        );
      })
      .join("");
    const isMesa = mesa.setor !== "comanda" && mesa.setor !== "retirada";
    const header = isMesa
      ? `<div style="font-weight:700;font-size:13pt">Mesa ${esc(String(mesa.numero).padStart(2, "0"))}</div>`
      : `<div style="font-weight:700;font-size:13pt">Cliente: ${esc(comanda.cliente_nome || "—")}</div>`;
    const html = `
      <div style="text-align:center;font-weight:700">PRÉ-CONTA</div>
      <div>--------------------------------</div>
      ${header}
      ${garcomNome ? `<div>Garçom: ${esc(garcomNome)}</div>` : ""}
      <div>${esc(new Date().toLocaleString("pt-BR"))}</div>
      <div>--------------------------------</div>
      ${linhas}
      <div>--------------------------------</div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${esc(brl(totalItens))}</span></div>
      ${Number(comanda.acrescimo) ? `<div style="display:flex;justify-content:space-between"><span>Acréscimo</span><span>${esc(brl(comanda.acrescimo))}</span></div>` : ""}
      ${Number(comanda.desconto) ? `<div style="display:flex;justify-content:space-between"><span>Desconto</span><span>- ${esc(brl(comanda.desconto))}</span></div>` : ""}
      ${taxaServico ? `<div style="display:flex;justify-content:space-between"><span>Taxa garçom</span><span>${esc(brl(taxaServico))}</span></div>` : ""}
      ${couvertTotal ? `<div style="display:flex;justify-content:space-between"><span>Couvert (${esc(comanda.couvert_pessoas)}p)</span><span>${esc(brl(couvertTotal))}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13pt"><span>TOTAL</span><span>${esc(brl(totalFinal))}</span></div>
      ${
        pagoTotal > 0
          ? `<div style="display:flex;justify-content:space-between"><span>Pago</span><span>${esc(brl(pagoTotal))}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Restante</span><span>${esc(brl(restante))}</span></div>`
          : ""
      }
      <div>--------------------------------</div>
      <div style="text-align:center;font-size:8pt;color:#666">Interno #${esc(String(mesa.numero).padStart(3, "0"))}</div>
      <div style="text-align:center">Não é documento fiscal</div>`;
    printTicketWindow(html);
  };

  const statusBadge = isCancelada
    ? { label: "Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/30" }
    : isFechada
      ? { label: "Fechada", cls: "bg-success/15 text-success border-success/30" }
      : {
          livre: { label: "Disponível", cls: "bg-muted text-muted-foreground border-border" },
          ocupada: { label: "Em atendimento", cls: "bg-primary/15 text-primary border-primary/30" },
          fechando: {
            label: "Fechamento solicitado",
            cls: "bg-warning/15 text-warning border-warning/30",
          },
        }[mesa.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-primary/10 border border-primary/30 grid place-items-center font-display text-xl text-primary">
                {String(mesa.numero).padStart(3, "0")}
              </div>
              <div>
                <SheetTitle className="font-display text-2xl leading-tight">
                  Comanda {String(mesa.numero).padStart(3, "0")}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {comanda?.cliente_nome ?? "Sem cliente"}
                  {mesa.setor ? ` · ${mesa.setor}` : ""}
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className={statusBadge.cls}>
              {statusBadge.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="grid place-items-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {!loading && !comanda && (
            <div className="text-center py-10 space-y-3">
              <p className="text-muted-foreground">
                Comanda disponível — nenhum cliente em atendimento.
              </p>
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4 mr-1" />
                Iniciar comanda
              </Button>
            </div>
          )}

          {!loading && comanda && (
            <Tabs defaultValue="conta">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="conta">Conta</TabsTrigger>
                <TabsTrigger value="historico">
                  <History className="size-3.5 mr-1" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conta" className="space-y-5 mt-4">
                {/* Dados da mesa */}
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                    Dados da comanda
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Cliente">
                      <button
                        onClick={() => {
                          setClienteInput(comanda.cliente_nome ?? "");
                          setEditCliente(true);
                        }}
                        className="text-left hover:text-primary transition truncate w-full"
                        disabled={!isAberta}
                      >
                        {comanda.cliente_nome || (
                          <span className="text-muted-foreground italic">definir...</span>
                        )}
                      </button>
                    </Info>
                    <Info label="Garçom">{garcomNome || "—"}</Info>
                    <Info label="Aberta em">
                      {new Date(comanda.aberta_em).toLocaleString("pt-BR")}
                    </Info>
                    <Info label="Tempo">{timeAgo(comanda.aberta_em)}</Info>
                  </div>
                </section>

                <Separator />

                {/* Itens */}
                <section className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                    Itens consumidos
                  </h3>
                  {itensValidos.length === 0 && itensCancelados.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item.</p>
                  )}
                  <div className="space-y-1.5">
                    {itensValidos.map((it) => {
                      const adics = adicionaisMap[it.id] ?? [];
                      return (
                        <div
                          key={it.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-lg bg-card border border-border"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              <span className="text-primary mr-1">{it.quantidade}×</span>
                              {it.produto_nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {brl(it.preco_unit)} cada
                            </p>
                            {adics.length > 0 && (
                              <ul className="text-[11px] text-primary/90 mt-0.5 space-y-0.5">
                                {adics.map((a, k) => (
                                  <li key={k}>
                                    + {a.nome}
                                    {a.preco > 0 ? ` (${brl(a.preco)})` : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {it.observacao && (
                              <p className="text-xs italic text-warning">{it.observacao}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-semibold mr-1">{brl(it.subtotal)}</span>
                            {isAberta && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => {
                                  setEditItem(it);
                                  setEditItemQtd(String(it.quantidade));
                                  setEditItemObs(it.observacao ?? "");
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {canCancel && isAberta && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive"
                                onClick={() => {
                                  setCancelItem(it);
                                  setCancelItemMotivo("");
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {itensCancelados.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-start justify-between gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-through text-muted-foreground">
                            {it.quantidade}× {it.produto_nome}
                          </p>
                          <p className="text-[11px] text-destructive">
                            Cancelado{it.motivo_cancelamento ? ` · ${it.motivo_cancelamento}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-destructive/40 text-destructive"
                        >
                          Cancelado
                        </Badge>
                      </div>
                    ))}
                  </div>
                </section>

                <Separator />

                {/* Financeiro */}
                <section className="space-y-1.5">
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                    Resumo financeiro
                  </h3>
                  <Row label="Subtotal" value={brl(totalItens)} />
                  {Number(comanda.acrescimo) > 0 && (
                    <Row
                      label="Acréscimo"
                      value={`+ ${brl(comanda.acrescimo)}`}
                      className="text-warning"
                    />
                  )}
                  {Number(comanda.desconto) > 0 && (
                    <Row
                      label="Desconto"
                      value={`- ${brl(comanda.desconto)}`}
                      className="text-success"
                    />
                  )}
                  {taxaServico > 0 && (
                    <Row
                      label={`Taxa de garçom${config?.taxa_garcom_percentual ? ` (${config.taxa_garcom_percentual}%)` : ""}`}
                      value={`+ ${brl(taxaServico)}`}
                      className="text-warning"
                    />
                  )}
                  {couvertTotal > 0 && (
                    <Row
                      label={`Couvert (${comanda.couvert_pessoas} pessoa${comanda.couvert_pessoas === 1 ? "" : "s"})`}
                      value={`+ ${brl(couvertTotal)}`}
                      className="text-warning"
                    />
                  )}
                  <Row label="Total" value={brl(totalFinal)} bold />
                  {config?.couvert_ativo && isAberta && isAdmin && (
                    <div className="flex items-center gap-2 pt-2">
                      <Label className="text-xs text-muted-foreground">Couvert (pessoas):</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-20 text-sm"
                        value={comanda.couvert_pessoas}
                        onChange={(e) => aplicarCouvert(Math.max(0, Number(e.target.value) || 0))}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        × {brl(config.couvert_valor)}
                      </span>
                    </div>
                  )}
                  {pagoTotal > 0 && (
                    <>
                      <Row label="Pago" value={brl(pagoTotal)} className="text-success" />
                      <Row label="Restante" value={brl(restante)} bold className="text-primary" />
                    </>
                  )}
                  {pagamentos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {pagamentos.map((p) => (
                        <div
                          key={p.id}
                          className="text-xs flex justify-between text-muted-foreground"
                        >
                          <span className="uppercase">
                            {p.forma}
                            {p.cliente_nome ? ` · ${p.cliente_nome}` : ""}
                          </span>
                          <span>{brl(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="historico" className="mt-4">
                {historico.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Sem registros ainda.
                  </p>
                )}
                <ol className="relative border-l border-border ml-2 space-y-3">
                  {historico.map((h) => (
                    <li key={h.id} className="ml-4">
                      <div className="absolute -left-1.5 size-3 rounded-full bg-primary border-2 border-background" />
                      <p className="text-sm font-medium">{acaoLabel[h.acao] ?? h.acao}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")} · {h.usuario_nome ?? "—"}
                        {h.valor != null ? ` · ${brl(Number(h.valor))}` : ""}
                      </p>
                      {h.detalhes && (
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5 break-words">
                          {formatDetalhes(h.detalhes)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Ações */}
        {comanda && (
          <div className="border-t border-border p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-sidebar">
            {canFinanceiro && caixaAberto === false && (
              <div className="col-span-2 sm:col-span-3 text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 rounded p-2">
                ⚠️ Caixa fechado — recebimentos e fechamento estão bloqueados.{" "}
                <a href="/admin?tab=caixa" className="underline font-medium">
                  Abrir caixa
                </a>
              </div>
            )}
            {isAberta && (
              <>
                <ActionBtn icon={Plus} label="Adicionar" onClick={() => setAddOpen(true)} />
                <ActionBtn icon={Edit} label="Editar pedido" onClick={() => setAddOpen(true)} />
                <ActionBtn icon={Printer} label="Pré-conta" onClick={imprimirPreConta} />
                <ActionBtn icon={Bell} label="Solicitar fechar" onClick={solicitarFechamento} />
                {canFinanceiro && (
                  <>
                    <ActionBtn
                      icon={Wallet}
                      label="Receber parcial"
                      onClick={() => {
                        setParcialValor(String(restante.toFixed(2)));
                        setParcialOpen(true);
                      }}
                    />
                    <ActionBtn
                      icon={Percent}
                      label="Desconto"
                      onClick={() => {
                        setDescontoTipo("desconto");
                        setDescontoInput("");
                        setDescontoOpen(true);
                      }}
                    />
                    <ActionBtn
                      icon={PlusCircle}
                      label="Acréscimo"
                      onClick={() => {
                        setDescontoTipo("acrescimo");
                        setDescontoInput("");
                        setDescontoOpen(true);
                      }}
                    />
                  </>
                )}
                {isAdmin && (
                  <>
                    <ActionBtn
                      icon={ArrowRightLeft}
                      label="Transferir"
                      onClick={() => setTransferOpen(true)}
                    />
                    <ActionBtn icon={Merge} label="Juntar" onClick={() => setJuntarOpen(true)} />
                    <ActionBtn
                      icon={Ban}
                      label="Cancelar comanda"
                      onClick={() => setCancelComandaOpen(true)}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    />
                  </>
                )}
                {canFinanceiro && (
                  <ActionBtn
                    icon={Receipt}
                    label="Fechar comanda"
                    onClick={fecharComanda}
                    className="col-span-2 sm:col-span-3 bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
                  />
                )}
              </>
            )}
            {isFechada && isAdmin && (
              <ActionBtn
                icon={RefreshCw}
                label="Reabrir comanda"
                onClick={() => setReabrirOpen(true)}
                className="col-span-2 sm:col-span-3 bg-warning text-warning-foreground hover:bg-warning/90 border-warning"
              />
            )}
            {isCancelada && (
              <p className="col-span-full text-center text-xs text-muted-foreground">
                Comanda cancelada — somente leitura.
              </p>
            )}
          </div>
        )}

        {/* ---- Diálogos ---- */}
        <AddItemsModal
          open={addOpen}
          onOpenChange={setAddOpen}
          mesaId={mesa.id}
          comandaId={comanda?.id ?? null}
          onCreated={carregar}
        />

        <Dialog open={editCliente} onOpenChange={setEditCliente}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cliente responsável</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nome do cliente"
              value={clienteInput}
              onChange={(e) => setClienteInput(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditCliente(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarCliente}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={descontoOpen} onOpenChange={setDescontoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Aplicar {descontoTipo === "desconto" ? "desconto" : "acréscimo"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={descontoModo === "valor" ? "default" : "outline"}
                  onClick={() => setDescontoModo("valor")}
                >
                  R$
                </Button>
                <Button
                  size="sm"
                  variant={descontoModo === "percent" ? "default" : "outline"}
                  onClick={() => setDescontoModo("percent")}
                >
                  %
                </Button>
              </div>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Subtotal atual: {brl(totalItens)}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDescontoOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={aplicarDescAcr}>Aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={parcialOpen} onOpenChange={setParcialOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receber parcial</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 text-center bg-card border border-border rounded-lg p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{brl(totalFinal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pago</p>
                  <p className="font-semibold text-success">{brl(pagoTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Restante</p>
                  <p className="font-semibold text-primary">{brl(restante)}</p>
                </div>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={parcialForma} onValueChange={(v) => setParcialForma(v as Forma)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Cartão de crédito</SelectItem>
                    <SelectItem value="debito">Cartão de débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  value={parcialValor}
                  onChange={(e) => setParcialValor(e.target.value)}
                />
              </div>
              <div>
                <Label>Cliente (opcional)</Label>
                <Input
                  value={parcialCliente}
                  onChange={(e) => setParcialCliente(e.target.value)}
                  placeholder="Quem está pagando"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setParcialOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={registrarParcial}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferir comanda</DialogTitle>
            </DialogHeader>
            <Label>Mover comanda para:</Label>
            <Select value={transferTo} onValueChange={setTransferTo}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma comanda livre" />
              </SelectTrigger>
              <SelectContent>
                {outrasMesas
                  .filter((m) => m.status === "livre")
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      Comanda {String(m.numero).padStart(3, "0")}
                      {m.setor ? ` · ${m.setor}` : ""}
                    </SelectItem>
                  ))}
                {outrasMesas.filter((m) => m.status === "livre").length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma comanda livre no momento
                  </div>
                )}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTransferOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={transferirMesa} disabled={!transferTo}>
                Transferir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={juntarOpen} onOpenChange={setJuntarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Juntar comandas</DialogTitle>
            </DialogHeader>
            <Label>Trazer itens da comanda:</Label>
            <Select value={juntarFrom} onValueChange={setJuntarFrom}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma comanda em atendimento" />
              </SelectTrigger>
              <SelectContent>
                {outrasMesas
                  .filter((m) => m.status !== "livre")
                  .map((m) => {
                    const c = outrasComandas[m.id];
                    const label = c?.cliente_nome
                      ? `Comanda ${String(m.numero).padStart(3, "0")} · ${c.cliente_nome}`
                      : `Comanda ${String(m.numero).padStart(3, "0")}${c?.codigo ? ` · #${c.codigo}` : ""}`;
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                {outrasMesas.filter((m) => m.status !== "livre").length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma outra comanda em atendimento
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os itens e pagamentos da comanda escolhida serão movidos para esta. A outra será
              liberada.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setJuntarOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={juntarComandas} disabled={!juntarFrom}>
                Juntar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancelar item */}
        <Dialog open={!!cancelItem} onOpenChange={(o) => !o && setCancelItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar item</DialogTitle>
              <DialogDescription>
                {cancelItem && `${cancelItem.quantidade}× ${cancelItem.produto_nome}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Motivo</Label>
              <Select value={cancelItemMotivo} onValueChange={setCancelItemMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pedido lançado errado">Pedido lançado errado</SelectItem>
                  <SelectItem value="Produto indisponível">Produto indisponível</SelectItem>
                  <SelectItem value="Cliente desistiu">Cliente desistiu</SelectItem>
                  <SelectItem value="Erro de cozinha">Erro de cozinha</SelectItem>
                  <SelectItem value="Cortesia">Cortesia</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                rows={2}
                placeholder="Detalhe (opcional)"
                value={cancelItemMotivo}
                onChange={(e) => setCancelItemMotivo(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelItem(null)}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={confirmarCancelItem}>
                Cancelar item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Editar item */}
        <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar item</DialogTitle>
              <DialogDescription>{editItem?.produto_nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={editItemQtd}
                  onChange={(e) => setEditItemQtd(e.target.value)}
                />
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea
                  rows={2}
                  value={editItemObs}
                  onChange={(e) => setEditItemObs(e.target.value)}
                />
              </div>
              {editItem && (adicionaisMap[editItem.id]?.length ?? 0) > 0 && (
                <div className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground mb-1">Adicionais atuais</p>
                  <ul className="text-xs space-y-0.5">
                    {(adicionaisMap[editItem.id] ?? []).map((a, k) => (
                      <li key={k} className="flex justify-between">
                        <span>+ {a.nome}</span>
                        {a.preco > 0 && <span className="text-primary">{brl(a.preco)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {editItem?.produto_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => abrirEditarAdicionais(editItem)}
                >
                  <Pencil className="size-3.5 mr-1" /> Editar adicionais
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditItem(null)}>
                Cancelar
              </Button>
              <Button onClick={salvarEditItem}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <PersonalizacaoModal
          open={!!editAdicionaisFor}
          onOpenChange={(o) => {
            if (!o) {
              setEditAdicionaisFor(null);
              setEditProdutoBase(null);
            }
          }}
          produto={editProdutoBase}
          obsInicial={editAdicionaisFor?.observacao ?? ""}
          modoEdicao
          onConfirm={salvarAdicionaisEditados}
        />

        {/* Cancelar comanda */}
        <Dialog open={cancelComandaOpen} onOpenChange={setCancelComandaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar comanda inteira</DialogTitle>
              <DialogDescription>
                A comanda permanecerá no histórico para auditoria. Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Motivo (obrigatório)</Label>
              <Textarea
                rows={3}
                value={cancelComandaMotivo}
                onChange={(e) => setCancelComandaMotivo(e.target.value)}
                placeholder="Ex: Cliente desistiu, erro de cadastro..."
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancelComandaOpen(false)}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={confirmarCancelComanda}>
                Cancelar comanda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reabrir comanda */}
        <Dialog open={reabrirOpen} onOpenChange={setReabrirOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reabrir comanda</DialogTitle>
              <DialogDescription>Informe o motivo da reabertura.</DialogDescription>
            </DialogHeader>
            <Textarea
              rows={3}
              value={reabrirMotivo}
              onChange={(e) => setReabrirMotivo(e.target.value)}
              placeholder="Ex: Item esquecido, ajuste de pagamento..."
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReabrirOpen(false)}>
                Voltar
              </Button>
              <Button onClick={confirmarReabrir}>Reabrir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

function formatDetalhes(d: Record<string, unknown>): string {
  try {
    if (d.itens && Array.isArray(d.itens)) {
      return (d.itens as Array<{ nome: string; qtd: number }>)
        .map((i) => `${i.qtd}× ${i.nome}`)
        .join(", ");
    }
    if (d.motivo) return String(d.motivo);
    if (d.item && d.motivo) return `${d.item} — ${d.motivo}`;
    if (d.item) return String(d.item);
    if (d.de && d.para) return `de ${JSON.stringify(d.de)} → ${JSON.stringify(d.para)}`;
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  } catch {
    return "";
  }
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-medium mt-0.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  className = "",
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between text-sm ${bold ? "font-display text-lg" : ""} ${className}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  className = "",
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`h-auto py-2.5 flex flex-col gap-1 text-xs ${className}`}
    >
      <Icon className="size-4" />
      <span className="leading-tight">{label}</span>
    </Button>
  );
}
