import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { useCaixaAberto } from "@/hooks/useCaixaAberto";
import { brl, timeAgo } from "@/lib/format";
import { logHistorico } from "@/lib/historico";
import { AddItemsModal } from "@/components/AddItemsModal";
import { PersonalizacaoModal, type AdicionalEscolhido } from "@/components/PersonalizacaoModal";
import { printTicketWindow } from "@/components/PrintTicket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  Pencil,
  Printer,
  Receipt,
  MoreVertical,
  Wallet,
  Percent,
  PlusCircle,
  ArrowRightLeft,
  Merge,
  Ban,
  ChevronDown,
  Loader2,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = supabase as any;

export const Route = createFileRoute("/_authenticated/garcom/mesa/$id")({
  component: ComandaDetalhe,
});

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
type Forma = "pix" | "dinheiro" | "credito" | "debito";

function ComandaDetalhe() {
  const { id: mesaId } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles, nome: userNome } = useAuth();
  const isAdmin = roles.includes("admin");
  const isCaixa = roles.includes("caixa");
  const canFinanceiro = isAdmin || isCaixa;
  const userLabel = userNome ?? user?.email ?? null;
  const { aberto: caixaAberto } = useCaixaAberto();

  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [adicionaisMap, setAdicionaisMap] = useState<
    Record<string, { nome: string; preco: number; grupo_nome: string | null }[]>
  >({});
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [garcomNome, setGarcomNome] = useState("");
  const [outrasMesas, setOutrasMesas] = useState<Mesa[]>([]);
  const [outrasComandas, setOutrasComandas] = useState<
    Record<string, { cliente_nome: string | null }>
  >({});
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const didAutoOpen = useRef(false);
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
  const [cancelComandaOpen, setCancelComandaOpen] = useState(false);
  const [cancelComandaMotivo, setCancelComandaMotivo] = useState("");
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editItemQtd, setEditItemQtd] = useState("1");
  const [editItemObs, setEditItemObs] = useState("");
  const [editAdicionaisFor, setEditAdicionaisFor] = useState<Item | null>(null);
  const [editProdutoBase, setEditProdutoBase] = useState<{
    id: string;
    nome: string;
    preco: number;
  } | null>(null);
  const [excluirItem, setExcluirItem] = useState<Item | null>(null);

  const carregar = async () => {
    const { data: m } = await supabase.from("mesas").select("*").eq("id", mesaId).maybeSingle();
    setMesa(m as Mesa | null);
    if (!m) {
      setLoading(false);
      return;
    }

    const { data: c } = await supabase
      .from("comandas")
      .select("*")
      .eq("mesa_id", mesaId)
      .in("status", ["aberta", "fechando", "fechada", "cancelada"])
      .order("aberta_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    setComanda(c as Comanda | null);

    if (c) {
      const [{ data: peds }, { data: pag }, { data: prof }] = await Promise.all([
        supabase.from("pedidos").select("*").eq("comanda_id", c.id).order("created_at"),
        supabase.from("pagamentos").select("*").eq("comanda_id", c.id).order("created_at"),
        c.garcom_id
          ? supabase.from("profiles").select("nome").eq("id", c.garcom_id).maybeSingle()
          : Promise.resolve({ data: null as { nome: string } | null }),
      ]);

      setPedidos((peds ?? []) as Pedido[]);
      setPagamentos((pag ?? []) as Pagamento[]);
      setGarcomNome(prof?.nome ?? "");
      const ids = (peds ?? []).map((p: Pedido) => p.id);
      if (ids.length) {
        const { data: its } = await supabase.from("itens_pedido").select("*").in("pedido_id", ids);
        const list = (its ?? []) as Item[];
        setItens(list);
        const itemIds = list.map((i) => i.id);
        if (itemIds.length) {
          const { data: adics } = await sbAny
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
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
    supabase
      .from("mesas")
      .select("*")
      .neq("id", mesaId)
      .order("numero")
      .then(({ data }) => setOutrasMesas((data ?? []) as Mesa[]));
    supabase
      .from("comandas")
      .select("mesa_id,cliente_nome")
      .eq("status", "aberta")
      .neq("mesa_id", mesaId)
      .then(({ data }) => {
        const map: Record<string, { cliente_nome: string | null }> = {};
        (data ?? []).forEach((c: { mesa_id: string | null; cliente_nome: string | null }) => {
          if (c.mesa_id) map[c.mesa_id] = { cliente_nome: c.cliente_nome };
        });
        setOutrasComandas(map);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesaId]);

  useRealtime(
    ["comandas", "pedidos", "itens_pedido", "itens_pedido_adicionais", "pagamentos"],
    () => carregar(),
    `comanda-${mesaId}`,
  );

  const itensValidos = useMemo(
    () =>
      itens.filter(
        (i) => !i.cancelado && pedidos.find((p) => p.id === i.pedido_id)?.status !== "cancelado",
      ),
    [itens, pedidos],
  );

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

  useEffect(() => {
    if (loading || didAutoOpen.current) return;
    if (mesa && !isFechada && !isCancelada && itensValidos.length === 0) {
      didAutoOpen.current = true;
      setAddOpen(true);
    }
  }, [loading, mesa, isFechada, isCancelada, itensValidos.length]);

  const statusChip = isCancelada
    ? { label: "Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/30" }
    : isFechada
      ? { label: "Finalizada", cls: "bg-success/15 text-success border-success/30" }
      : mesa?.status === "fechando"
        ? { label: "Fechamento", cls: "bg-warning/15 text-warning border-warning/40" }
        : {
            label: "Em atendimento",
            cls: "bg-destructive/15 text-destructive border-destructive/30",
          };

  /* ----------- ações ----------- */

  const setorPorPedido = (id: string) => pedidos.find((p) => p.id === id)?.setor ?? "cozinha";

  const imprimirPedido = () => {
    if (!comanda || !mesa) return;
    if (itensValidos.length === 0) {
      toast.error("Nada para imprimir");
      return;
    }
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    // agrupa por setor
    const grupos: Record<string, Item[]> = {};
    itensValidos.forEach((i) => {
      (grupos[setorPorPedido(i.pedido_id)] ||= []).push(i);
    });
    const blocos = Object.entries(grupos)
      .map(([setor, its]) => {
        const linhas = its
          .map((i) => {
            const ads = adicionaisMap[i.id] ?? [];
            const grupos: Record<string, { nome: string }[]> = {};
            ads.forEach((a) => {
              const g = a.grupo_nome ?? "Adicionais";
              (grupos[g] ||= []).push({ nome: a.nome });
            });
            const adHtml = Object.entries(grupos)
              .map(
                ([g, arr]) => `
          <div style="margin-left:3mm;font-size:10pt">
            <div style="font-weight:600">${esc(g)}:</div>
            ${arr.map((a) => `<div>&nbsp;&nbsp;• ${esc(a.nome)}</div>`).join("")}
          </div>`,
              )
              .join("");
            return (
              `<div style="margin-bottom:2mm"><div style="font-weight:700">${esc(i.quantidade)}x ${esc(i.produto_nome)}</div>${adHtml}` +
              (i.observacao
                ? `<div style="font-style:italic;margin-left:3mm">Obs: ${esc(i.observacao)}</div>`
                : "") +
              `</div>`
            );
          })
          .join("");
        const isMesa = mesa.setor !== "comanda" && mesa.setor !== "retirada";
        const headerLoc = isMesa
          ? `Mesa ${esc(String(mesa.numero).padStart(2, "0"))}`
          : `Cliente: ${esc(comanda?.cliente_nome || "—")}`;
        return `<div style="text-align:center;font-weight:700">PEDIDO ${esc(setor.toUpperCase())}</div>
        <div>--------------------------------</div>
        <div style="font-weight:700">${headerLoc}</div>
        ${garcomNome ? `<div>Garçom: ${esc(garcomNome)}</div>` : ""}
        <div>${esc(new Date().toLocaleString("pt-BR"))}</div>
        <div>--------------------------------</div>${linhas}
        <div>--------------------------------</div>`;
      })
      .join('<div style="page-break-after:always"></div>');
    printTicketWindow(blocos);
  };

  const imprimirPreConta = () => {
    if (!comanda || !mesa) return;
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
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
    const html = `<div style="text-align:center;font-weight:700">PRÉ-CONTA</div>
      <div>--------------------------------</div>
      ${header}
      
      ${garcomNome ? `<div>Garçom: ${esc(garcomNome)}</div>` : ""}
      <div>${esc(new Date().toLocaleString("pt-BR"))}</div>
      <div>--------------------------------</div>${linhas}
      <div>--------------------------------</div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${esc(brl(totalItens))}</span></div>
      ${Number(comanda.acrescimo) ? `<div style="display:flex;justify-content:space-between"><span>Acréscimo</span><span>${esc(brl(comanda.acrescimo))}</span></div>` : ""}
      ${Number(comanda.desconto) ? `<div style="display:flex;justify-content:space-between"><span>Desconto</span><span>- ${esc(brl(comanda.desconto))}</span></div>` : ""}
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
      toast.error("Abra o caixa antes de registrar pagamentos");
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
    const deveFechar = fecharAposPagar && Math.max(0, totalFinal - (pagoTotal + v)) <= 0.01;
    setParcialOpen(false);
    setParcialValor("");
    setParcialCliente("");
    setFecharAposPagar(false);
    await carregar();
    if (deveFechar) await finalizarFechamento();
  };

  const finalizarFechamento = async () => {
    if (!comanda || !mesa) return;
    await supabase
      .from("comandas")
      .update({ status: "fechada", fechada_em: new Date().toISOString() })
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
    navigate({ to: "/pedidos" });
  };

  const fecharConta = async () => {
    if (!comanda) return;
    if (caixaAberto === false) {
      toast.error("Abra o caixa antes de fechar comandas");
      return;
    }
    if (itensValidos.length === 0) {
      toast.error("Comanda sem itens");
      return;
    }
    if (restante > 0.01) {
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

  const salvarEditItem = async () => {
    if (!editItem || !comanda) return;
    const q = Math.max(1, Number(editItemQtd) || 1);
    const obs = editItemObs.trim() || null;
    const { error } = await supabase
      .from("itens_pedido")
      .update({ quantidade: q, observacao: obs })
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
    toast.success("Adicionais atualizados");
    setEditAdicionaisFor(null);
    setEditProdutoBase(null);
    setEditItem(null);
    carregar();
  };

  const duplicarItem = async (item: Item) => {
    if (!comanda) return;
    const { data: novo, error } = await sbAny
      .from("itens_pedido")
      .insert({
        pedido_id: item.pedido_id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        preco_unit: item.preco_unit,
        quantidade: item.quantidade,
        observacao: item.observacao,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const adics = adicionaisMap[item.id] ?? [];
    if (adics.length && novo) {
      const empresaId = (await sbAny.rpc("minha_empresa_id")).data;
      const rows = adics.map((a) => ({
        empresa_id: empresaId,
        item_pedido_id: novo.id,
        adicional_nome: a.nome,
        grupo_nome: a.grupo_nome,
        preco: a.preco,
        quantidade: 1,
      }));
      await sbAny.from("itens_pedido_adicionais").insert(rows);
    }
    toast.success("Item duplicado");
    carregar();
  };

  const confirmarExcluir = async () => {
    if (!excluirItem || !comanda) return;
    const { error } = await supabase
      .from("itens_pedido")
      .update({
        cancelado: true,
        cancelado_em: new Date().toISOString(),
        cancelado_por: user?.id ?? null,
        motivo_cancelamento: "Removido pelo garçom",
      })
      .eq("id", excluirItem.id);
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
        item: excluirItem.produto_nome,
        qtd: excluirItem.quantidade,
        motivo: "Removido pelo garçom",
      },
      valor: Number(excluirItem.subtotal),
    });
    toast.success("Item removido");
    setExcluirItem(null);
    carregar();
  };

  const transferirMesa = async () => {
    if (!comanda || !transferTo || !mesa) return;
    const destino = outrasMesas.find((m) => m.id === transferTo);
    if (destino?.status !== "livre") {
      toast.error("Destino precisa estar livre");
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
    toast.success(`Movida para comanda ${destino?.numero}`);
    setTransferOpen(false);
    navigate({ to: "/garcom/mesa/$id", params: { id: transferTo } });
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
      toast.error("Origem não tem comanda aberta");
      return;
    }
    await supabase.from("pedidos").update({ comanda_id: comanda.id }).eq("comanda_id", origem.id);
    await supabase
      .from("pagamentos")
      .update({ comanda_id: comanda.id })
      .eq("comanda_id", origem.id);
    await supabase
      .from("comandas")
      .update({ status: "fechada", fechada_em: new Date().toISOString() })
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

  const confirmarCancelComanda = async () => {
    if (!comanda || !mesa) return;
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
    navigate({ to: "/pedidos" });
  };

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  if (!mesa)
    return <div className="p-6 text-center text-muted-foreground">Comanda não encontrada.</div>;

  const nComanda = String(mesa.numero).padStart(3, "0");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* HEADER — tudo em uma linha */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-3 py-2 md:px-4 md:py-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-1 shrink-0">
            <Link to="/pedidos">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-base md:text-xl leading-none whitespace-nowrap">
                COMANDA {nComanda}
              </span>
              {comanda?.cliente_nome && (
                <span className="text-xs md:text-sm text-muted-foreground truncate">
                  · {comanda.cliente_nome}
                </span>
              )}
              <Badge
                variant="outline"
                className={`ml-1 shrink-0 text-[10px] px-1.5 py-0 h-5 ${statusChip.cls}`}
              >
                {statusChip.label}
              </Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
              Valor
            </p>
            <p className="font-display text-lg md:text-2xl text-primary leading-tight">
              {brl(totalFinal)}
            </p>
          </div>
        </div>
      </header>

      {caixaAberto === false && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs md:text-sm px-3 py-2 text-center">
          {canFinanceiro ? (
            <>
              ⚠️ Caixa fechado.{" "}
              <Link to="/admin" className="underline font-semibold">
                Abrir caixa
              </Link>{" "}
              antes de receber pagamentos.
            </>
          ) : (
            <>
              ⚠️ Caixa fechado. Você pode lançar itens, mas o financeiro está indisponível até o
              caixa ser aberto.
            </>
          )}
        </div>
      )}

      {/* CONTEÚDO */}
      <main className="flex-1 overflow-y-auto p-3 pb-28 md:pb-24 space-y-3 max-w-3xl w-full mx-auto">
        {/* ITENS — imediato */}
        <section>
          {itensValidos.length > 0 && (
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Itens lançados <span className="text-foreground">({itensValidos.length})</span>
              </h2>
            </div>
          )}

          {itensValidos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Comanda vazia</p>
          ) : (
            <ul className="space-y-2">
              {itensValidos.map((it) => {
                const adics = adicionaisMap[it.id] ?? [];
                return (
                  <li
                    key={it.id}
                    className="bg-card border border-border rounded-xl p-3 flex gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">
                        <span className="text-primary mr-1">{it.quantidade}×</span>
                        {it.produto_nome}
                      </p>
                      {adics.length > 0 && (
                        <ul className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5">
                          {adics.map((a, k) => (
                            <li key={k}>
                              + {a.nome}
                              {a.preco > 0 ? ` (${brl(a.preco)})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {it.observacao && (
                        <p className="text-[11px] italic text-warning mt-0.5">{it.observacao}</p>
                      )}
                      <p className="text-xs font-semibold text-foreground mt-1">
                        {brl(it.subtotal)}
                      </p>
                    </div>
                    {isAberta && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          title="Editar"
                          onClick={() => {
                            setEditItem(it);
                            setEditItemQtd(String(it.quantidade));
                            setEditItemObs(it.observacao ?? "");
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          title="Duplicar"
                          onClick={() => duplicarItem(it)}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 text-destructive border-destructive/40"
                          title="Excluir"
                          onClick={() => setExcluirItem(it)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* DADOS DA COMANDA (colapsado) — só depois que houver itens */}
        {itensValidos.length > 0 && (
          <Collapsible>
            <div className="bg-card border border-border rounded-xl">
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Ver detalhes
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 grid grid-cols-2 gap-2 text-xs">
                  <DetalheItem label="Cliente" value={comanda?.cliente_nome || "—"} />
                  <DetalheItem label="Garçom" value={garcomNome || "—"} />
                  <DetalheItem
                    label="Horário"
                    value={comanda ? new Date(comanda.aberta_em).toLocaleString("pt-BR") : "—"}
                  />
                  <DetalheItem
                    label="Tempo em aberto"
                    value={comanda ? timeAgo(comanda.aberta_em) : "—"}
                  />
                  {(Number(comanda?.desconto) > 0 || Number(comanda?.acrescimo) > 0) && (
                    <>
                      {Number(comanda?.desconto) > 0 && (
                        <DetalheItem label="Desconto" value={`- ${brl(comanda!.desconto)}`} />
                      )}
                      {Number(comanda?.acrescimo) > 0 && (
                        <DetalheItem label="Acréscimo" value={`+ ${brl(comanda!.acrescimo)}`} />
                      )}
                    </>
                  )}
                  {pagoTotal > 0 && (
                    <>
                      <DetalheItem label="Pago" value={brl(pagoTotal)} />
                      <DetalheItem label="Restante" value={brl(restante)} />
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </main>

      {isAberta && itensValidos.length === 0 && (
        <footer className="sticky bottom-0 z-30 bg-card border-t border-border pb-[max(env(safe-area-inset-bottom),4px)]">
          <div className="px-3 pt-1.5 pb-1.5 max-w-3xl mx-auto">
            <button
              onClick={() => setAddOpen(true)}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition"
            >
              <Plus className="size-5" />
              Adicionar Item
            </button>
          </div>
        </footer>
      )}

      {isAberta && itensValidos.length > 0 && (
        <footer className="sticky bottom-0 z-30 bg-card border-t border-border pb-[max(env(safe-area-inset-bottom),4px)]">
          {/* Ações rápidas */}
          <div className="px-3 pt-1 grid grid-cols-4 gap-1.5 max-w-3xl mx-auto">
            <QuickAction icon={Plus} label="Adicionar Item" onClick={() => setAddOpen(true)} />
            <QuickAction icon={Printer} label="Pagamento" onClick={imprimirPedido} />
            <QuickAction icon={Receipt} label="Pré-conta" onClick={imprimirPreConta} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-0.5 h-8 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition">
                  <MoreVertical className="size-4" />
                  <span className="text-[10px] font-medium">Mais</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canFinanceiro && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setParcialForma("pix");
                        setParcialValor("");
                        setParcialCliente(comanda?.cliente_nome ?? "");
                        setFecharAposPagar(false);
                        setParcialOpen(true);
                      }}
                    >
                      <Wallet className="size-4 mr-2" /> Receber parcial
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDescontoTipo("desconto");
                        setDescontoInput("");
                        setDescontoOpen(true);
                      }}
                    >
                      <Percent className="size-4 mr-2" /> Desconto
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setDescontoTipo("acrescimo");
                        setDescontoInput("");
                        setDescontoOpen(true);
                      }}
                    >
                      <PlusCircle className="size-4 mr-2" /> Acréscimo
                    </DropdownMenuItem>
                  </>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                      <ArrowRightLeft className="size-4 mr-2" /> Transferir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setJuntarOpen(true)}>
                      <Merge className="size-4 mr-2" /> Juntar comandas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setCancelComandaOpen(true)}
                    >
                      <Ban className="size-4 mr-2" /> Cancelar comanda
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Fechar conta */}
          {canFinanceiro && (
            <div className="px-3 pt-1 pb-1 max-w-3xl mx-auto">
              <button
                onClick={fecharConta}
                className="w-full h-9 rounded-xl bg-destructive text-destructive-foreground font-semibold flex items-center justify-between px-3 shadow-md active:scale-[0.99] transition"
              >
                <div className="text-left">
                  <p className="text-[9px] uppercase tracking-wider opacity-80 leading-none">
                    Total
                  </p>
                  <p className="font-display text-sm leading-tight">{brl(totalFinal)}</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wide">Fechar Conta</span>
              </button>
            </div>
          )}
        </footer>
      )}

      {isFechada && (
        <footer className="sticky bottom-0 bg-success/10 border-t border-success/30 p-3 text-center text-sm text-success font-semibold">
          Comanda finalizada · {brl(totalFinal)}
        </footer>
      )}
      {isCancelada && (
        <footer className="sticky bottom-0 bg-destructive/10 border-t border-destructive/30 p-3 text-center text-sm text-destructive font-semibold">
          Comanda cancelada
        </footer>
      )}

      {/* ---- Diálogos ---- */}
      <AddItemsModal
        open={addOpen}
        onOpenChange={setAddOpen}
        mesaId={mesa.id}
        comandaId={comanda?.id ?? null}
        onCreated={carregar}
      />

      {/* Excluir item */}
      <Dialog open={!!excluirItem} onOpenChange={(o) => !o && setExcluirItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover item?</DialogTitle>
            <DialogDescription>
              {excluirItem && `${excluirItem.quantidade}× ${excluirItem.produto_nome}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExcluirItem(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmarExcluir}>
              Remover
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

      {/* Desconto/Acréscimo */}
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

      {/* Receber parcial */}
      <Dialog open={parcialOpen} onOpenChange={setParcialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center bg-muted rounded-lg p-2">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                <p className="font-semibold">{brl(totalFinal)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Pago</p>
                <p className="font-semibold text-success">{brl(pagoTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Restante</p>
                <p className="font-semibold text-primary">{brl(restante)}</p>
              </div>
            </div>
            <div>
              <Label>Forma</Label>
              <Select value={parcialForma} onValueChange={(v) => setParcialForma(v as Forma)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
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
              <Input value={parcialCliente} onChange={(e) => setParcialCliente(e.target.value)} />
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

      {/* Transferir */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir comanda</DialogTitle>
          </DialogHeader>
          <Label>Mover para:</Label>
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
                  </SelectItem>
                ))}
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

      {/* Juntar */}
      <Dialog open={juntarOpen} onOpenChange={setJuntarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Juntar comandas</DialogTitle>
          </DialogHeader>
          <Label>Trazer itens de:</Label>
          <Select value={juntarFrom} onValueChange={setJuntarFrom}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma comanda aberta" />
            </SelectTrigger>
            <SelectContent>
              {outrasMesas
                .filter((m) => m.status !== "livre")
                .map((m) => {
                  const c = outrasComandas[m.id];
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      Comanda {String(m.numero).padStart(3, "0")}
                      {c?.cliente_nome ? ` · ${c.cliente_nome}` : ""}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Os itens serão movidos para esta comanda. A outra será liberada.
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

      {/* Cancelar comanda */}
      <Dialog open={cancelComandaOpen} onOpenChange={setCancelComandaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar comanda</DialogTitle>
            <DialogDescription>
              Ação irreversível — a comanda permanecerá no histórico.
            </DialogDescription>
          </DialogHeader>
          <Label>Motivo (obrigatório)</Label>
          <Textarea
            rows={3}
            value={cancelComandaMotivo}
            onChange={(e) => setCancelComandaMotivo(e.target.value)}
          />
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
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition"
    >
      <Icon className="size-4" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function DetalheItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-foreground truncate">{value}</p>
    </div>
  );
}
