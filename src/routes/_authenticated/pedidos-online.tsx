import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { brl, timeAgo } from "@/lib/format";
import {
  criarWhatsAppUrl,
  mensagemStatusClienteWhatsApp,
  type StatusWhatsApp,
} from "@/lib/whatsappMessage";
import { AccessGate } from "@/components/AccessGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { confirmDelete, handleDeleteError } from "@/lib/confirm";

import { printTicketWindow } from "@/components/PrintTicket";
import {
  Loader2,
  Search,
  X,
  Phone,
  Clock,
  CheckCircle2,
  ChefHat,
  PackageCheck,
  Ban,
  Play,
  Check,
  ArrowRight,
  MessageCircle,
  Printer,
  Trash2,
  Store,
  Bike,
  MapPin,
  MoreVertical,
  Truck,
  Flag,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/pedidos-online")({
  head: () => ({ meta: [{ title: "Pedidos Online" }] }),
  component: PedidosOnlineView,
});

type StatusOnline =
  "novo" | "aceito" | "preparo" | "pronto" | "em_rota" | "finalizado" | "cancelado";
type Filtro = "todos" | StatusOnline | "hoje" | "ontem" | "entrega" | "retirada";

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_entrega: "Cartão na entrega",
};

type Comanda = {
  id: string;
  mesa_id: string;
  total: number;
  aberta_em: string;
  cliente_nome: string | null;
  observacao: string | null;
  status: string;
  status_online: StatusOnline | null;
  tipo_entrega: string | null;
  taxa_entrega: number | null;
  forma_pagamento: string | null;
  troco_para: number | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  tempo_estimado_min: number | null;
  tempo_estimado_max: number | null;
};
type Item = {
  id: string;
  comanda_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unit: number;
  observacao: string | null;
};
type Adic = {
  item_pedido_id: string;
  adicional_nome: string;
  grupo_nome: string | null;
  preco: number;
  quantidade: number;
};

const STATUS_META: Record<
  StatusOnline,
  { label: string; dot: string; badge: string; ring: string }
> = {
  novo: {
    label: "Novo",
    dot: "bg-primary",
    badge: "bg-primary/15 text-primary border-primary/30",
    ring: "border-primary/50",
  },
  aceito: {
    label: "Aceito",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    ring: "border-sky-500/40",
  },
  preparo: {
    label: "Em preparo",
    dot: "bg-warning",
    badge: "bg-warning/15 text-warning border-warning/40",
    ring: "border-warning/40",
  },
  pronto: {
    label: "Pronto",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    ring: "border-emerald-500/40",
  },
  em_rota: {
    label: "Em rota",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
    ring: "border-indigo-500/40",
  },
  finalizado: {
    label: "Finalizado",
    dot: "bg-success",
    badge: "bg-success/15 text-success border-success/30",
    ring: "border-success/30",
  },
  cancelado: {
    label: "Cancelado",
    dot: "bg-foreground/50",
    badge: "bg-muted text-muted-foreground border-border",
    ring: "border-border",
  },
};

function extractWhatsapp(obs: string | null): string {
  if (!obs) return "";
  const m = obs.match(/WhatsApp:\s*([\d\s()+-]+)/i);
  return m ? m[1].replace(/\D/g, "") : "";
}
function isLocal(obs: string | null) {
  return !!obs && /CONSUMO LOCAL/i.test(obs);
}
function fmtPhone(d: string) {
  const s = d.replace(/^55/, "");
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return d;
}
function sameDay(iso: string, d: Date) {
  const x = new Date(iso);
  return (
    x.getFullYear() === d.getFullYear() &&
    x.getMonth() === d.getMonth() &&
    x.getDate() === d.getDate()
  );
}

function PedidosOnlineView() {
  const { roles, empresa } = useAuth();
  const canAdmin = roles.includes("admin") || roles.includes("caixa") || roles.includes("cozinha");

  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [adics, setAdics] = useState<Adic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const statusToWa = (st: StatusOnline): StatusWhatsApp | null => {
    if (st === "novo") return "recebido";
    if (st === "aceito") return "aceito";
    if (st === "preparo") return "preparo";
    if (st === "pronto") return "pronto";
    if (st === "em_rota") return "pronto";
    if (st === "finalizado") return "finalizado";
    if (st === "cancelado") return "cancelado";
    return null;
  };

  const tipoEntregaDe = (c: Comanda): "entrega" | "retirada" | "local" => {
    const t = (c.tipo_entrega || "").toLowerCase();
    if (t === "entrega") return "entrega";
    if (t === "local" || isLocal(c.observacao)) return "local";
    return "retirada";
  };

  const mensagemStatusCliente = (c: Comanda, status: StatusWhatsApp = "pronto"): string => {
    return mensagemStatusClienteWhatsApp({
      comanda: c,
      itens,
      adicionais: adics,
      nomeEmpresa: empresa?.nome,
      status,
      tipoEntrega: tipoEntregaDe(c),
    });
  };

  const linkWaCliente = (tel: string, c: Comanda, status: StatusWhatsApp = "pronto") => {
    return criarWhatsAppUrl(tel, mensagemStatusCliente(c, status));
  };

  const abrirWACliente = (c: Comanda, status?: StatusWhatsApp) => {
    const tel = extractWhatsapp(c.observacao);
    if (!tel) {
      toast.error("Cliente não informou um WhatsApp válido.");
      return;
    }
    if (tipoEntregaDe(c) === "local") {
      toast.error("Pedido de consumo local — WhatsApp indisponível.");
      return;
    }
    const st = status ?? statusToWa(statusOf(c)) ?? "pronto";
    window.open(linkWaCliente(tel, c, st), "_blank", "noopener");
  };

  const primeiroNome = (nome: string | null) =>
    (nome || "cliente").trim().split(/\s+/)[0] || "cliente";

  const acaoManualWA = (c: Comanda): { label: string; message: string } | null => {
    const st = statusOf(c);
    const tipo = tipoEntregaDe(c);
    if (tipo === "local") return null;
    const nome = primeiroNome(c.cliente_nome);
    const emp = (empresa?.nome || "").trim() || "Nosso estabelecimento";
    if (st === "aceito") {
      return {
        label: "📲 Avisar pedido aceito",
        message:
          `Olá, *${nome}*! 👋\n\n` +
          `Recebemos e confirmamos o seu pedido. ✅\n\n` +
          `Nossa equipe já iniciou o preparo e em breve ele estará pronto.\n\n` +
          `Agradecemos pela preferência!\n\n` +
          `*${emp}*`,
      };
    }
    if (st === "em_rota" && tipo === "entrega") {
      return {
        label: "🛵 Avisar que saiu para entrega",
        message:
          `Olá, *${nome}*! 👋\n\n` +
          `Seu pedido já saiu para entrega. 🛵\n\n` +
          `Em breve ele chegará ao endereço informado.\n\n` +
          `Obrigado pela preferência!\n\n` +
          `*${emp}*`,
      };
    }
    return null;
  };

  const abrirAcaoManualWA = (c: Comanda) => {
    const tel = extractWhatsapp(c.observacao);
    if (!tel) {
      toast.error("Telefone do cliente não informado ou inválido.");
      return;
    }
    const acao = acaoManualWA(c);
    if (!acao) return;
    window.open(criarWhatsAppUrl(tel, acao.message), "_blank", "noopener");
  };

  const fetchAll = async () => {
    const desdeOntem = new Date();
    desdeOntem.setHours(0, 0, 0, 0);
    desdeOntem.setDate(desdeOntem.getDate() - 1);
    // Regra global: pedidos cancelados são excluídos automaticamente.
    await supabase.from("comandas").delete().eq("origem", "online").eq("status", "cancelada");
    const { data: c } = await supabase
      .from("comandas")
      .select(
        "id,mesa_id,total,aberta_em,cliente_nome,observacao,status,status_online,tipo_entrega,taxa_entrega,forma_pagamento,troco_para,endereco_cep,endereco_rua,endereco_numero,endereco_complemento,endereco_bairro,endereco_cidade,endereco_estado,tempo_estimado_min,tempo_estimado_max",
      )
      .eq("origem", "online")
      .neq("status", "cancelada")
      .gte("aberta_em", desdeOntem.toISOString())
      .order("aberta_em", { ascending: false });
    const lista = (c ?? []) as Comanda[];
    setComandas(lista);
    if (lista.length) {
      const { data: peds } = await supabase
        .from("pedidos")
        .select("id,comanda_id")
        .in(
          "comanda_id",
          lista.map((x) => x.id),
        );
      const pedList = (peds ?? []) as { id: string; comanda_id: string }[];
      if (pedList.length) {
        const { data: its } = await supabase
          .from("itens_pedido")
          .select("id,pedido_id,produto_nome,quantidade,preco_unit,observacao,cancelado")
          .in(
            "pedido_id",
            pedList.map((p) => p.id),
          );
        const pedToCom: Record<string, string> = {};
        pedList.forEach((p) => {
          pedToCom[p.id] = p.comanda_id;
        });
        const itsFiltered = (its ?? []).filter((i) => !i.cancelado);
        setItens(
          itsFiltered.map((i) => ({
            id: i.id,
            comanda_id: pedToCom[i.pedido_id],
            produto_nome: i.produto_nome,
            quantidade: Number(i.quantidade),
            preco_unit: Number(i.preco_unit),
            observacao: i.observacao,
          })),
        );
        if (itsFiltered.length) {
          const { data: ads } = await supabase
            .from("itens_pedido_adicionais")
            .select("item_pedido_id,adicional_nome,grupo_nome,preco,quantidade")
            .in(
              "item_pedido_id",
              itsFiltered.map((i) => i.id),
            );
          setAdics(
            (ads ?? []).map((a) => ({
              item_pedido_id: a.item_pedido_id,
              adicional_nome: a.adicional_nome,
              grupo_nome: a.grupo_nome,
              preco: Number(a.preco),
              quantidade: Number(a.quantidade),
            })),
          );
        } else setAdics([]);
      } else {
        setItens([]);
        setAdics([]);
      }
    } else {
      setItens([]);
      setAdics([]);
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchAll();
  }, []);
  useRealtime(["comandas", "pedidos", "itens_pedido"], fetchAll, "pedidos-online");
  useEffect(() => {
    const t = setInterval(() => {
      fetchAll();
    }, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    import("@/lib/pedidosNotify").then((m) => m.clearNovos());
  }, []);

  // Auto-hide finalizados/cancelados após 3s e destaque pulse em novos pedidos
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hidingIds, setHidingIds] = useState<Set<string>>(new Set());
  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const scheduledHideRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(comandas.map((c) => c.id));

    // Novos pedidos (não existiam antes) → pulse por ~5s
    if (prevIdsRef.current.size > 0) {
      const novos: string[] = [];
      currentIds.forEach((id) => {
        if (!prevIdsRef.current.has(id)) novos.push(id);
      });
      if (novos.length > 0) {
        setPulsingIds((s) => {
          const n = new Set(s);
          novos.forEach((id) => n.add(id));
          return n;
        });
        setTimeout(() => {
          setPulsingIds((s) => {
            const n = new Set(s);
            novos.forEach((id) => n.delete(id));
            return n;
          });
        }, 5000);
      }
    }
    prevIdsRef.current = currentIds;

    // Reaparecer no banco (ex.: reabertura) → limpar hidden
    setHiddenIds((s) => {
      let changed = false;
      const n = new Set(s);
      s.forEach((id) => {
        if (!currentIds.has(id)) {
          n.delete(id);
          changed = true;
        }
      });
      return changed ? n : s;
    });

    // Agendar remoção de finalizados/cancelados após 3s
    comandas.forEach((c) => {
      const st =
        c.status === "cancelada"
          ? "cancelado"
          : c.status === "fechada"
            ? "finalizado"
            : (c.status_online ?? "novo");
      if (
        (st === "finalizado" || st === "cancelado") &&
        !scheduledHideRef.current.has(c.id) &&
        !hiddenIds.has(c.id)
      ) {
        scheduledHideRef.current.add(c.id);
        setTimeout(() => {
          setHidingIds((s) => {
            const n = new Set(s);
            n.add(c.id);
            return n;
          });
          setTimeout(() => {
            setHidingIds((s) => {
              const n = new Set(s);
              n.delete(c.id);
              return n;
            });
            setHiddenIds((s) => {
              const n = new Set(s);
              n.add(c.id);
              return n;
            });
            scheduledHideRef.current.delete(c.id);
          }, 700);
        }, 3000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandas]);

  const statusOf = (c: Comanda): StatusOnline => {
    if (c.status === "cancelada") return "cancelado";
    if (c.status === "fechada") return "finalizado";
    return (c.status_online ?? "novo") as StatusOnline;
  };

  const counts = useMemo(() => {
    const acc = {
      novo: 0,
      aceito: 0,
      preparo: 0,
      pronto: 0,
      em_rota: 0,
      finalizado: 0,
      cancelado: 0,
    } as Record<StatusOnline, number>;
    comandas.forEach((c) => {
      acc[statusOf(c)]++;
    });
    return acc;
  }, [comandas]);

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const buscaLower = busca.trim().toLowerCase();
  const filtrados = comandas.filter((c) => {
    const st = statusOf(c);
    // Ocultar da tela operacional pedidos finalizados/cancelados após 3s,
    // exceto quando o usuário explicitamente filtra por eles ou pelo período.
    const ocultaHistorico = !["finalizado", "cancelado", "hoje", "ontem"].includes(filtro);
    if (ocultaHistorico && hiddenIds.has(c.id)) return false;
    const tipoC = (c.tipo_entrega || (isLocal(c.observacao) ? "local" : "retirada")).toLowerCase();
    if (filtro === "hoje" && !sameDay(c.aberta_em, hoje)) return false;
    if (filtro === "ontem" && !sameDay(c.aberta_em, ontem)) return false;
    if (filtro === "entrega" && tipoC !== "entrega") return false;
    if (filtro === "retirada" && tipoC !== "retirada") return false;
    if (!["todos", "hoje", "ontem", "entrega", "retirada"].includes(filtro) && st !== filtro)
      return false;
    if (!buscaLower) return true;
    const cli = (c.cliente_nome ?? "").toLowerCase();
    const tel = extractWhatsapp(c.observacao);
    return cli.includes(buscaLower) || tel.includes(buscaLower);
  });

  const buildProducaoHtml = (c: Comanda) => {
    const its = itens.filter((i) => i.comanda_id === c.id);
    const tipoLocal = isLocal(c.observacao);
    const tipoEntrega = (c.tipo_entrega || (tipoLocal ? "local" : "retirada")).toLowerCase();
    const tipoLabel =
      tipoEntrega === "entrega" ? "ENTREGA" : tipoLocal ? "CONSUMO LOCAL" : "RETIRADA";
    const hora = new Date(c.aberta_em).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const linha = "--------------------------------";
    const itensHtml = its
      .map((i) => {
        const meusAd = adics.filter((a) => a.item_pedido_id === i.id);
        const grupos: Record<string, Adic[]> = {};
        meusAd.forEach((a) => {
          const g = a.grupo_nome ?? "Adicionais";
          (grupos[g] ??= []).push(a);
        });
        const adHtml = Object.entries(grupos)
          .map(
            ([g, arr]) => `
        <div style="margin-left:3mm;font-size:10pt">
          <div style="font-weight:600">${g}:</div>
          ${arr.map((a) => `<div>&nbsp;&nbsp;• ${a.quantidade}x ${a.adicional_nome}</div>`).join("")}
        </div>`,
          )
          .join("");
        const obs = i.observacao
          ? `<div style="font-style:italic;margin-left:3mm">Obs: ${i.observacao}</div>`
          : "";
        return `<div style="margin-bottom:2mm">
        <div style="font-weight:700">${i.quantidade}x ${i.produto_nome}</div>
        ${adHtml}${obs}
      </div>`;
      })
      .join("");
    return `
      <div style="text-align:center;font-weight:700;font-size:14pt">VIA PRODUÇÃO</div>
      <div style="text-align:center;font-weight:700">${tipoLabel}</div>
      <div>${linha}</div>
      <div style="font-weight:700">Cliente: ${c.cliente_nome ?? "—"}</div>
      <div>Horário: ${hora}</div>
      <div>${linha}</div>
      ${itensHtml}
      <div>${linha}</div>
    `;
  };

  const buildEntregaHtml = (c: Comanda) => {
    const its = itens.filter((i) => i.comanda_id === c.id);
    const tel = extractWhatsapp(c.observacao);
    const tipoLocal = isLocal(c.observacao);
    const tipoEntrega = (c.tipo_entrega || (tipoLocal ? "local" : "retirada")).toLowerCase();
    const isEntrega = tipoEntrega === "entrega";
    const hora = new Date(c.aberta_em).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const linha = "--------------------------------";
    const taxa = Number(c.taxa_entrega || 0);
    const total = Number(c.total || 0);
    const subtotal = total - (isEntrega ? taxa : 0);
    const itensHtml = its
      .map((i) => {
        const meusAd = adics.filter((a) => a.item_pedido_id === i.id);
        const ad = meusAd
          .map((a) => `<div>&nbsp;&nbsp;- ${a.quantidade}x ${a.adicional_nome}</div>`)
          .join("");
        const obs = i.observacao
          ? `<div style="font-style:italic;margin-left:3mm">Obs: ${i.observacao}</div>`
          : "";
        return `<div style="margin-bottom:2mm">
        <div style="font-weight:700">${i.quantidade}x ${i.produto_nome}</div>
        ${ad}${obs}
      </div>`;
      })
      .join("");
    const cabecalho = isEntrega
      ? `<div style="text-align:center;font-weight:700;font-size:14pt">PEDIDO PARA ENTREGA</div>`
      : `<div style="text-align:center;font-weight:700;font-size:14pt">RETIRADA NO BALCÃO</div>`;
    const enderecoBloco = isEntrega
      ? `
      <div style="font-weight:700">Endereço:</div>
      <div>${[c.endereco_rua, c.endereco_numero].filter(Boolean).join(", ") || "—"}</div>
      ${c.endereco_complemento ? `<div>Complemento: ${c.endereco_complemento}</div>` : ""}
      ${c.endereco_bairro ? `<div>Bairro: ${c.endereco_bairro}</div>` : ""}
      ${c.endereco_cidade ? `<div>Cidade: ${c.endereco_cidade}${c.endereco_estado ? " / " + c.endereco_estado : ""}</div>` : ""}
      <div>${linha}</div>
    `
      : "";
    const pagamento = c.forma_pagamento
      ? (FORMA_LABEL[c.forma_pagamento] ?? c.forma_pagamento)
      : "—";
    const trocoLinha =
      c.forma_pagamento === "dinheiro" && c.troco_para
        ? `<div>Troco para: ${brl(Number(c.troco_para))}</div>`
        : "";
    const totaisBloco = `
      <div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
      ${isEntrega && taxa > 0 ? `<div style="display:flex;justify-content:space-between"><span>Taxa de entrega:</span><span>${brl(taxa)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13pt"><span>TOTAL:</span><span>${brl(total)}</span></div>
    `;
    return `
      ${cabecalho}
      <div>${linha}</div>
      <div style="font-weight:700">Cliente: ${c.cliente_nome ?? "—"}</div>
      ${tel ? `<div>Telefone: ${fmtPhone(tel)}</div>` : ""}
      <div>${linha}</div>
      ${enderecoBloco}
      <div style="font-weight:700">Itens:</div>
      ${itensHtml}
      <div>${linha}</div>
      <div style="font-weight:700">Pagamento: ${pagamento}</div>
      ${trocoLinha}
      <div>${linha}</div>
      ${totaisBloco}
      <div>${linha}</div>
      <div>Horário do pedido: ${hora}</div>
    `;
  };

  const imprimirProducao = (c: Comanda) => printTicketWindow(buildProducaoHtml(c));
  const imprimirEntrega = (c: Comanda) => printTicketWindow(buildEntregaHtml(c));
  const imprimirTudo = (c: Comanda) =>
    printTicketWindow(
      `${buildProducaoHtml(c)}<div style="page-break-after:always;margin:4mm 0"></div>${buildEntregaHtml(c)}`,
    );

  const setStatus = async (c: Comanda, novo: StatusOnline) => {
    setBusy(c.id);
    try {
      if (novo === "cancelado") {
        // Regra global: cancelar = excluir do sistema.
        const { error } = await supabase.from("comandas").delete().eq("id", c.id);
        if (error) throw error;
        setComandas((prev) => prev.filter((x) => x.id !== c.id));
        toast.success("Pedido cancelado e removido");
        return;
      }
      const patch: {
        status_online: StatusOnline;
        status: "aberta" | "fechada";
        fechada_em?: string | null;
      } = { status_online: novo, status: "aberta", fechada_em: null };
      if (novo === "finalizado") {
        patch.status = "fechada";
        patch.fechada_em = new Date().toISOString();
      }
      const { error } = await supabase.from("comandas").update(patch).eq("id", c.id);
      if (error) throw error;
      toast.success(`Pedido marcado como ${STATUS_META[novo].label.toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const excluir = async (c: Comanda) => {
    if (!(await confirmDelete(c.cliente_nome ?? "este pedido"))) return;
    setBusy(c.id);
    try {
      const { error } = await supabase.from("comandas").delete().eq("id", c.id);
      if (handleDeleteError(error)) {
        setBusy(null);
        return;
      }
      setComandas((prev) => prev.filter((x) => x.id !== c.id));
      setItens((prev) => prev.filter((x) => x.comanda_id !== c.id));
      setAdics((prev) =>
        prev.filter((a) => !itens.some((i) => i.comanda_id === c.id && i.id === a.item_pedido_id)),
      );
      toast.success("Pedido excluído com sucesso.");
      await fetchAll();
    } catch (e) {
      handleDeleteError(e as { code?: string; message?: string });
    } finally {
      setBusy(null);
    }
  };

  if (loading)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );

  const FILTROS: { key: Filtro; label: string; count?: number; dot?: string }[] = [
    { key: "todos", label: "Todos", count: comandas.length, dot: "bg-muted-foreground" },
    { key: "novo", label: "Novos", count: counts.novo, dot: STATUS_META.novo.dot },
    { key: "aceito", label: "Aceitos", count: counts.aceito, dot: STATUS_META.aceito.dot },
    { key: "preparo", label: "Em preparo", count: counts.preparo, dot: STATUS_META.preparo.dot },
    { key: "pronto", label: "Prontos", count: counts.pronto, dot: STATUS_META.pronto.dot },
    {
      key: "finalizado",
      label: "Finalizados",
      count: counts.finalizado,
      dot: STATUS_META.finalizado.dot,
    },
    {
      key: "cancelado",
      label: "Cancelados",
      count: counts.cancelado,
      dot: STATUS_META.cancelado.dot,
    },
    { key: "entrega", label: "🛵 Entrega" },
    { key: "retirada", label: "🛍 Retirada" },
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
  ];

  return (
    <AccessGate isAdmin={canAdmin}>
      <div className="p-3 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">
        <div className="mb-4">
          <h1 className="font-display text-2xl md:text-4xl leading-none">PEDIDOS ONLINE</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Fluxo separado das comandas internas. Atualize o status conforme o preparo.
          </p>
        </div>

        <div className="relative mb-3">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou telefone"
            className="h-12 pl-10 pr-10 text-base"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
              aria-label="Limpar"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border transition ${
                filtro === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              {f.dot && <span className={`size-2 rounded-full ${f.dot}`} />}
              <span>{f.label}</span>
              {typeof f.count === "number" && (
                <span
                  className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${filtro === f.key ? "bg-background/20" : "bg-muted"}`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((c) => {
            const st = statusOf(c);
            const meta = STATUS_META[st];
            const tel = extractWhatsapp(c.observacao);
            const its = itens.filter((i) => i.comanda_id === c.id);
            const tipoLocal = isLocal(c.observacao);
            const tipoEntrega = (
              c.tipo_entrega || (tipoLocal ? "local" : "retirada")
            ).toLowerCase();
            const isEntrega = tipoEntrega === "entrega";
            const endereco = [c.endereco_rua, c.endereco_numero].filter(Boolean).join(", ");

            // Aging
            const ageMin = (Date.now() - new Date(c.aberta_em).getTime()) / 60000;
            const isActive = st !== "finalizado" && st !== "cancelado";
            const ageCls =
              isActive && ageMin >= 40
                ? "border-destructive ring-2 ring-destructive/30"
                : isActive && ageMin >= 20
                  ? "border-warning ring-2 ring-warning/20"
                  : meta.ring;
            const ageBadge =
              isActive && ageMin >= 40
                ? {
                    cls: "bg-destructive/15 text-destructive border-destructive/40",
                    label: `${Math.floor(ageMin)} min`,
                  }
                : isActive && ageMin >= 20
                  ? {
                      cls: "bg-warning/15 text-warning border-warning/40",
                      label: `${Math.floor(ageMin)} min`,
                    }
                  : null;

            // Timeline
            const timelineSteps: { key: StatusOnline; label: string }[] = isEntrega
              ? [
                  { key: "novo", label: "Novo" },
                  { key: "aceito", label: "Aceito" },
                  { key: "preparo", label: "Preparo" },
                  { key: "pronto", label: "Pronto" },
                  { key: "em_rota", label: "Em rota" },
                  { key: "finalizado", label: "Entregue" },
                ]
              : [
                  { key: "novo", label: "Novo" },
                  { key: "aceito", label: "Aceito" },
                  { key: "preparo", label: "Preparo" },
                  { key: "pronto", label: "Pronto" },
                  { key: "finalizado", label: "Retirado" },
                ];
            const currentIdx = timelineSteps.findIndex((s) => s.key === st);

            return (
              <div
                key={c.id}
                className={`bg-card border-2 rounded-xl px-3 py-2.5 flex flex-col gap-2 transition-all ${ageCls} ${hidingIds.has(c.id) ? "op-fade-out" : ""} ${pulsingIds.has(c.id) ? "op-pulse-new" : ""}`}
              >
                {/* COMPACTO — apenas essencial */}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span
                        className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.badge}`}
                      >
                        <span className={`size-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isEntrega ? "bg-sky-500/15 text-sky-600 border-sky-500/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"}`}
                      >
                        {isEntrega ? <Bike className="size-3" /> : <Store className="size-3" />}
                        {isEntrega ? "Entrega" : tipoLocal ? "Local" : "Retirada"}
                      </span>
                      {ageBadge && (
                        <span
                          className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${ageBadge.cls}`}
                        >
                          <AlertTriangle className="size-3" /> {ageBadge.label}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold leading-tight truncate">
                      {c.cliente_nome || "Sem nome"}
                    </h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                      <Clock className="size-3" /> há {timeAgo(c.aberta_em)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-xl text-primary leading-none">
                      {brl(Number(c.total))}
                    </div>
                  </div>
                </div>

                {/* RESUMO DOS PRODUTOS — sempre visível */}
                {its.length > 0 && (
                  <div className="text-[12px] leading-snug bg-secondary/40 border border-border rounded-md px-2 py-1.5">
                    {its.length === 1 ? (
                      (() => {
                        const i = its[0];
                        const meusAd = adics.filter((a) => a.item_pedido_id === i.id);
                        return (
                          <div>
                            <div className="font-semibold">
                              {i.quantidade}x {i.produto_nome}
                            </div>
                            {meusAd.slice(0, 4).map((a, idx) => (
                              <div key={idx} className="text-muted-foreground pl-2">
                                + {a.adicional_nome}
                                {a.quantidade > 1 ? ` (${a.quantidade})` : ""}
                              </div>
                            ))}
                            {meusAd.length > 4 && (
                              <div className="text-muted-foreground pl-2">
                                +{meusAd.length - 4} adicionais
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-0.5">
                        {its.slice(0, 3).map((i) => (
                          <div key={i.id} className="font-semibold">
                            {i.quantidade}x {i.produto_nome}
                          </div>
                        ))}
                        {its.length > 3 && (
                          <div className="text-muted-foreground">
                            +{its.length - 3} {its.length - 3 === 1 ? "item" : "itens"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* AÇÕES do status atual */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {st === "novo" && (
                    <ActionBtn
                      onClick={() => setStatus(c, "aceito")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<Check className="size-4" />}
                    >
                      Aceitar
                    </ActionBtn>
                  )}
                  {st === "aceito" && (
                    <ActionBtn
                      onClick={() => setStatus(c, "preparo")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<ChefHat className="size-4" />}
                    >
                      Em preparo
                    </ActionBtn>
                  )}
                  {st === "preparo" && isEntrega && (
                    <ActionBtn
                      onClick={() => setStatus(c, "em_rota")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<Truck className="size-4" />}
                    >
                      Saiu para entrega
                    </ActionBtn>
                  )}
                  {st === "preparo" && !isEntrega && (
                    <ActionBtn
                      onClick={() => setStatus(c, "pronto")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<PackageCheck className="size-4" />}
                    >
                      Pedido pronto
                    </ActionBtn>
                  )}
                  {st === "pronto" && !isEntrega && (
                    <ActionBtn
                      onClick={() => setStatus(c, "finalizado")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<CheckCircle2 className="size-4" />}
                    >
                      Finalizar
                    </ActionBtn>
                  )}
                  {st === "em_rota" && (
                    <ActionBtn
                      onClick={() => setStatus(c, "finalizado")}
                      busy={busy === c.id}
                      tone="primary"
                      icon={<Flag className="size-4" />}
                    >
                      Finalizar entrega
                    </ActionBtn>
                  )}

                  {/* WhatsApp contextual */}
                  {(st === "aceito" || (st === "em_rota" && isEntrega)) &&
                    !tipoLocal &&
                    (() => {
                      const acao = acaoManualWA(c);
                      if (!acao || !tel) return null;
                      return (
                        <button
                          onClick={() => abrirAcaoManualWA(c)}
                          title={acao.label}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600"
                        >
                          <MessageCircle className="size-3.5" /> {acao.label}
                        </button>
                      );
                    })()}

                  {/* Imprimir (sem "Tudo") */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border text-[11px] font-medium hover:bg-secondary">
                        <Printer className="size-3.5" /> Imprimir <ChevronDown className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => imprimirProducao(c)}>
                        <ChefHat className="size-4 mr-2" /> Produção
                      </DropdownMenuItem>
                      {isEntrega && (
                        <DropdownMenuItem onClick={() => imprimirEntrega(c)}>
                          <Bike className="size-4 mr-2" /> Entrega
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Mais ações */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border hover:bg-secondary ml-auto"
                        aria-label="Mais ações"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isActive && st !== "novo" && (
                        <DropdownMenuItem onClick={() => setStatus(c, "novo")}>
                          <Play className="size-4 mr-2" /> Voltar para Novo
                        </DropdownMenuItem>
                      )}
                      {(st === "finalizado" || st === "cancelado") && (
                        <DropdownMenuItem onClick={() => setStatus(c, "novo")}>
                          <Play className="size-4 mr-2" /> Reabrir
                        </DropdownMenuItem>
                      )}
                      {isActive && (
                        <DropdownMenuItem onClick={() => setStatus(c, "cancelado")}>
                          <Ban className="size-4 mr-2" /> Cancelar pedido
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => excluir(c)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Ver detalhes */}
                <button
                  onClick={() => toggleExpand(c.id)}
                  className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border-t border-border pt-1.5"
                >
                  {expandidos.has(c.id) ? (
                    <>
                      <ChevronUp className="size-3.5" /> Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3.5" /> Ver detalhes
                    </>
                  )}
                </button>

                {expandidos.has(c.id) && (
                  <div className="border-t border-border pt-2 space-y-2 text-xs">
                    {/* Telefone */}
                    {tel && !tipoLocal && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${tel}`}
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <Phone className="size-3.5" /> {fmtPhone(tel)}
                        </a>
                        <a
                          href={linkWaCliente(tel, c)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir WhatsApp"
                          className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                      </div>
                    )}

                    {/* Endereço */}
                    {isEntrega && (c.endereco_bairro || endereco) && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="size-3.5 mt-0.5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          {c.endereco_bairro && (
                            <div className="font-bold text-foreground">{c.endereco_bairro}</div>
                          )}
                          {endereco && (
                            <div className="text-muted-foreground">
                              {endereco}
                              {c.endereco_complemento ? ` · ${c.endereco_complemento}` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Produtos */}
                    <div className="space-y-1">
                      {its.map((i) => {
                        const meusAd = adics.filter((a) => a.item_pedido_id === i.id);
                        return (
                          <div key={i.id}>
                            <div className="flex justify-between gap-2">
                              <span className="truncate">
                                <span className="font-semibold">{i.quantidade}×</span>{" "}
                                {i.produto_nome}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {brl(i.preco_unit * i.quantidade)}
                              </span>
                            </div>
                            {meusAd.length > 0 && (
                              <ul className="text-[11px] text-muted-foreground pl-4 space-y-0.5">
                                {meusAd.map((a, idx) => (
                                  <li key={idx}>
                                    + {a.quantidade}× {a.adicional_nome}
                                    {a.preco > 0 ? ` (${brl(a.preco * a.quantidade)})` : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {i.observacao && (
                              <div className="text-[11px] italic text-muted-foreground pl-4">
                                Obs: {i.observacao}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {its.length === 0 && (
                        <div className="text-muted-foreground italic">Sem itens</div>
                      )}
                    </div>

                    {/* Pagamento + taxa */}
                    {(c.forma_pagamento || (c.taxa_entrega && Number(c.taxa_entrega) > 0)) && (
                      <div className="flex items-center justify-between flex-wrap gap-2 border-t border-border pt-1.5">
                        {c.forma_pagamento && (
                          <span className="text-muted-foreground">
                            💳 {FORMA_LABEL[c.forma_pagamento] ?? c.forma_pagamento}
                            {c.forma_pagamento === "dinheiro" && c.troco_para
                              ? ` · troco p/ ${brl(Number(c.troco_para))}`
                              : ""}
                          </span>
                        )}
                        {c.taxa_entrega && Number(c.taxa_entrega) > 0 && (
                          <span className="text-muted-foreground">
                            🛵 Taxa {brl(Number(c.taxa_entrega))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-16 border-2 border-dashed border-border rounded-xl">
              <ArrowRight className="size-6 mx-auto mb-2 opacity-40" />
              Nenhum pedido online para este filtro.
            </div>
          )}
        </div>
      </div>
    </AccessGate>
  );
}

function ActionBtn({
  children,
  onClick,
  busy,
  tone,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone: "primary" | "danger" | "ghost";
  icon: React.ReactNode;
}) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
        : "border border-border text-foreground hover:bg-secondary";
  return (
    <Button onClick={onClick} disabled={busy} className={`h-9 px-3 text-xs ${cls}`} variant="ghost">
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      <span className="ml-1.5">{children}</span>
    </Button>
  );
}
