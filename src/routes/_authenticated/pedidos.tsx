import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { brl, timeAgo } from "@/lib/format";
import { Loader2, Plus, Search, X, Utensils, ShoppingBag, Printer } from "lucide-react";
import { printTicketWindow } from "@/components/PrintTicket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AccessGate } from "@/components/AccessGate";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Comandas" }] }),
  component: PedidosView,
});

type Mesa = {
  id: string;
  numero: number;
  setor: string | null;
  status: "livre" | "ocupada" | "fechando";
};
type Comanda = {
  id: string;
  mesa_id: string;
  total: number;
  aberta_em: string;
  codigo: string;
  status: string;
  cliente_nome: string | null;
  garcom_id: string;
  observacao: string | null;
  fechada_em?: string | null;
  cancelada_em?: string | null;
  origem?: string;
};
type CardStatus = "atendimento" | "fechamento" | "finalizada" | "cancelada";
type StatusFilter = "todos" | CardStatus;

const STATUS_ORDER: Record<CardStatus, number> = {
  atendimento: 0,
  fechamento: 1,
  finalizada: 2,
  cancelada: 3,
};

function PedidosView() {
  const { user, roles } = useAuth();
  const isAdmin =
    roles.includes("admin") ||
    roles.includes("caixa") ||
    roles.includes("garcom") ||
    roles.includes("cozinha");
  const navigate = useNavigate();

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [abertas, setAbertas] = useState<Comanda[]>([]);
  const [finalizadas, setFinalizadas] = useState<Comanda[]>([]);
  const [canceladas, setCanceladas] = useState<Comanda[]>([]);
  const [itensCount, setItensCount] = useState<Record<string, number>>({});
  const [garcons, setGarcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState<Record<string, Comanda>>({});
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const [filtro, setFiltro] = useState<StatusFilter>("todos");
  const [busca, setBusca] = useState("");

  const [novaOpen, setNovaOpen] = useState(false);
  const [novaCliente, setNovaCliente] = useState("");
  const [criando, setCriando] = useState(false);

  const fetchAll = async () => {
    // Regra global: comandas canceladas são removidas automaticamente do sistema.
    await supabase.from("comandas").delete().eq("status", "cancelada");
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from("mesas").select("id,numero,setor,status").order("numero"),
      supabase.from("comandas").select("*").eq("status", "aberta"),
    ]);
    const novasAbertas = ((c ?? []) as Comanda[]).filter((x) => x.origem !== "online");

    // Detecta comandas que acabaram de sair da lista de abertas → fade-out por 2.5s
    setAbertas((prev) => {
      const prevIds = new Set(prev.map((x) => x.id));
      const nowIds = new Set(novasAbertas.map((x) => x.id));
      const desaparecidas = prev.filter((x) => !nowIds.has(x.id));
      if (desaparecidas.length) {
        setFading((f) => {
          const n = { ...f };
          desaparecidas.forEach((d) => {
            n[d.id] = d;
          });
          return n;
        });
        desaparecidas.forEach((d) => {
          setTimeout(() => {
            setFading((f) => {
              const n = { ...f };
              delete n[d.id];
              return n;
            });
          }, 2500);
        });
      }
      // Detecta novas (para pulso)
      novasAbertas.forEach((n) => {
        if (!prevIds.has(n.id)) {
          setNewIds((s) => new Set(s).add(n.id));
          setTimeout(
            () =>
              setNewIds((s) => {
                const n2 = new Set(s);
                n2.delete(n.id);
                return n2;
              }),
            5000,
          );
        }
      });
      return novasAbertas;
    });
    setMesas((m ?? []) as Mesa[]);
    setFinalizadas([]);
    setCanceladas([]);

    const gids = [...new Set(novasAbertas.map((x) => x.garcom_id))];
    if (gids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", gids);
      const gm: Record<string, string> = {};
      (profs ?? []).forEach((p) => {
        gm[p.id] = p.nome;
      });
      setGarcons(gm);
    }
    const abertasIds = novasAbertas.map((x) => x.id);

    if (abertasIds.length) {
      const { data: peds } = await supabase
        .from("pedidos")
        .select("id,comanda_id")
        .in("comanda_id", abertasIds);
      const pedList = (peds ?? []) as { id: string; comanda_id: string }[];
      const pedIds = pedList.map((p) => p.id);
      if (pedIds.length) {
        const { data: its } = await supabase
          .from("itens_pedido")
          .select("pedido_id,quantidade,cancelado")
          .in("pedido_id", pedIds);
        const map: Record<string, number> = {};
        const pedToCom: Record<string, string> = {};
        pedList.forEach((p) => {
          pedToCom[p.id] = p.comanda_id;
        });
        (its ?? []).forEach((it) => {
          if (it.cancelado) return;
          const cid = pedToCom[it.pedido_id];
          if (!cid) return;
          map[cid] = (map[cid] ?? 0) + Number(it.quantidade);
        });
        setItensCount(map);
      }
    }
    setLoading(false);
  };
  useEffect(() => {
    fetchAll();
  }, [user?.id]);
  useRealtime(["mesas", "comandas", "pedidos", "itens_pedido"], fetchAll, "pedidos-view");

  type Row = { comanda: Comanda; status: CardStatus; fading?: boolean; isNew?: boolean };
  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];
    abertas.forEach((c) => {
      if (c.origem === "online") return; // pedidos online vivem em /pedidos-online
      const mesa = mesas.find((m) => m.id === c.mesa_id);
      list.push({
        comanda: c,
        status: mesa?.status === "fechando" ? "fechamento" : "atendimento",
        isNew: newIds.has(c.id),
      });
    });
    // Ghost cards (fade-out) para comandas recém-finalizadas
    Object.values(fading).forEach((c) => {
      if (c.origem === "online") return;
      list.push({ comanda: c, status: "finalizada", fading: true });
    });

    return list.sort((a, b) => {
      const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (d !== 0) return d;
      return new Date(b.comanda.aberta_em).getTime() - new Date(a.comanda.aberta_em).getTime();
    });
  }, [abertas, fading, newIds, mesas]);

  const counts = useMemo(() => {
    const acc = { atendimento: 0, fechamento: 0, finalizada: 0, cancelada: 0 } as Record<
      CardStatus,
      number
    >;
    rows.forEach((r) => {
      acc[r.status]++;
    });
    return acc;
  }, [rows]);

  const buscaLower = busca.trim().toLowerCase();
  const filtrados = rows.filter((r) => {
    if (filtro !== "todos" && r.status !== filtro) return false;
    if (!buscaLower) return true;
    const cli = (r.comanda.cliente_nome ?? "").toLowerCase();
    const mesa = mesas.find((m) => m.id === r.comanda.mesa_id);
    const num = String(mesa?.numero ?? "").padStart(3, "0");
    const obs = (r.comanda.observacao ?? "").toLowerCase(); // pode conter telefone/WhatsApp
    return cli.includes(buscaLower) || num.includes(buscaLower) || obs.includes(buscaLower);
  });

  const criarPedido = async () => {
    if (!user) return;
    setCriando(true);
    try {
      const proximo = (mesas.reduce((mx, m) => Math.max(mx, m.numero), 0) || 0) + 1;
      const { data: novaMesa, error: me } = await supabase
        .from("mesas")
        .insert({ numero: proximo, lugares: 1, setor: "comanda" })
        .select()
        .single();
      if (me) throw me;
      const { error } = await supabase
        .from("comandas")
        .insert({
          mesa_id: novaMesa.id,
          garcom_id: user.id,
          cliente_nome: novaCliente.trim() || null,
          codigo: "",
          observacao: "[LOCAL]",
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("mesas").update({ status: "ocupada" }).eq("id", novaMesa.id);

      setNovaOpen(false);
      setNovaCliente("");
      toast.success("Comanda aberta");
      navigate({ to: "/garcom/mesa/$id", params: { id: novaMesa.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCriando(false);
    }
  };

  const imprimirComanda = async (c: Comanda, numero: number) => {
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const { data: peds } = await supabase.from("pedidos").select("id,setor").eq("comanda_id", c.id);
    const pedList = (peds ?? []) as { id: string; setor: string }[];
    if (!pedList.length) {
      toast.error("Nada para imprimir");
      return;
    }
    const { data: its } = await supabase
      .from("itens_pedido")
      .select("id,pedido_id,produto_nome,quantidade,observacao,cancelado")
      .in(
        "pedido_id",
        pedList.map((p) => p.id),
      );
    const itens = (its ?? []).filter((i) => !i.cancelado) as {
      id: string;
      pedido_id: string;
      produto_nome: string;
      quantidade: number;
      observacao: string | null;
    }[];
    if (!itens.length) {
      toast.error("Nada para imprimir");
      return;
    }
    const { data: ads } = await supabase
      .from("itens_pedido_adicionais")
      .select("item_pedido_id,adicional_nome,grupo_nome")
      .in(
        "item_pedido_id",
        itens.map((i) => i.id),
      );
    const adMap: Record<string, { nome: string; grupo: string }[]> = {};
    (ads ?? []).forEach((a) => {
      (adMap[a.item_pedido_id] ||= []).push({
        nome: a.adicional_nome,
        grupo: a.grupo_nome ?? "Adicionais",
      });
    });
    const setorPed: Record<string, string> = {};
    pedList.forEach((p) => {
      setorPed[p.id] = p.setor ?? "cozinha";
    });
    const grupos: Record<string, typeof itens> = {};
    itens.forEach((i) => {
      const s = setorPed[i.pedido_id] ?? "cozinha";
      (grupos[s] ||= []).push(i);
    });
    const dt = new Date().toLocaleString("pt-BR");
    const blocos = Object.entries(grupos)
      .map(([setor, its]) => {
        const linhas = its
          .map((i) => {
            const grAds: Record<string, string[]> = {};
            (adMap[i.id] ?? []).forEach((a) => {
              (grAds[a.grupo] ||= []).push(a.nome);
            });
            const adHtml = Object.entries(grAds)
              .map(
                ([g, arr]) => `
          <div style="margin-left:3mm;font-size:10pt">
            <div style="font-weight:600">${esc(g)}:</div>
            ${arr.map((n) => `<div>&nbsp;&nbsp;• ${esc(n)}</div>`).join("")}
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
        return `<div style="text-align:center;font-weight:700">PEDIDO ${esc(setor.toUpperCase())}</div>
        <div>--------------------------------</div>
        <div style="font-weight:700">Cliente: ${esc(c.cliente_nome || `#${String(numero).padStart(3, "0")}`)}</div>
        <div>${esc(dt)}</div>
        <div>--------------------------------</div>${linhas}
        <div>--------------------------------</div>`;
      })
      .join('<div style="page-break-after:always"></div>');
    printTicketWindow(blocos);
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const INDICADORES: { key: StatusFilter; dot: string; label: string; count: number }[] = [
    {
      key: "todos",
      dot: "bg-muted-foreground",
      label: "Todas",
      count: counts.atendimento + counts.fechamento,
    },
    {
      key: "atendimento",
      dot: "bg-destructive",
      label: "Em atendimento",
      count: counts.atendimento,
    },
    { key: "fechamento", dot: "bg-warning", label: "Fechamento", count: counts.fechamento },
  ];

  return (
    <AccessGate isAdmin={isAdmin}>
      <div className="p-3 md:p-6 max-w-7xl mx-auto pb-24 md:pb-6">
        {/* Cabeçalho */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-4xl leading-none truncate">COMANDAS</h1>
            <p className="text-xs text-muted-foreground mt-1 hidden md:block">
              Toque em uma comanda para abrir a conta.
            </p>
          </div>
          {/* Botão fixo no topo direito (desktop) */}
          <Button onClick={() => setNovaOpen(true)} className="hidden md:inline-flex h-11 px-5">
            <Plus className="size-4 mr-1.5" /> Nova Comanda
          </Button>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou nº interno"
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

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {INDICADORES.map((i) => (
            <IndicatorPill
              key={i.key}
              active={filtro === i.key}
              onClick={() => setFiltro(i.key)}
              dot={i.dot}
              label={i.label}
              count={i.count}
            />
          ))}
        </div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtrados.map((r) => {
            const mesa = mesas.find((m) => m.id === r.comanda.mesa_id);
            return (
              <div
                key={r.comanda.id}
                className={`${r.fading ? "op-fade-out" : ""} ${r.isNew ? "op-pulse-new rounded-2xl" : ""}`}
              >
                <ComandaCard
                  numero={mesa?.numero ?? 0}
                  cliente={r.comanda.cliente_nome}
                  total={Number(r.comanda.total)}
                  horario={r.comanda.aberta_em}
                  itens={itensCount[r.comanda.id] ?? 0}
                  status={r.status}
                  garcomNome={garcons[r.comanda.garcom_id] ?? ""}
                  onOpen={() => {
                    if (r.fading) return;
                    if (mesa) navigate({ to: "/garcom/mesa/$id", params: { id: mesa.id } });
                  }}
                  onPrint={() => imprimirComanda(r.comanda, mesa?.numero ?? 0)}
                />
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-16 border-2 border-dashed border-border rounded-xl">
              Nenhuma comanda para este filtro.
            </div>
          )}
        </div>

        {/* FAB mobile */}
        <button
          onClick={() => setNovaOpen(true)}
          className="md:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 grid place-items-center active:scale-95 transition"
          aria-label="Nova comanda"
        >
          <Plus className="size-6" />
        </button>

        {/* Modal Nova Comanda */}
        <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova Comanda</DialogTitle>
              <DialogDescription>Abertura rápida — vamos direto ao cardápio.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Cliente (opcional)</Label>
                <Input
                  autoFocus
                  className="h-12 text-base"
                  value={novaCliente}
                  onChange={(e) => setNovaCliente(e.target.value)}
                  placeholder="Ex: Maria"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setNovaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={criarPedido} disabled={criando} className="h-12 text-base">
                {criando ? <Loader2 className="size-4 animate-spin" /> : "Abrir comanda"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AccessGate>
  );
}

function IndicatorPill({
  active,
  onClick,
  dot,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border transition ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-foreground border-border hover:border-primary/40"
      }`}
    >
      <span className={`size-2 rounded-full ${dot}`} />
      <span>{label}</span>
      <span
        className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? "bg-background/20" : "bg-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

function TipoBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-red-500",
];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function ComandaCard({
  numero,
  cliente,
  total,
  horario,
  itens,
  status,
  garcomNome,
  onOpen,
  onPrint,
}: {
  numero: number;
  cliente: string | null;
  total: number;
  horario: string;
  itens: number;
  status: CardStatus;
  garcomNome: string;
  onOpen: () => void;
  onPrint: () => void;
}) {
  const STATUS = {
    atendimento: {
      label: "Em atendimento",
      dot: "bg-destructive",
      badge: "bg-destructive/12 text-destructive border-destructive/30",
      ring: "hover:border-destructive/40",
    },
    fechamento: {
      label: "Fechamento",
      dot: "bg-warning",
      badge: "bg-warning/12 text-warning border-warning/40",
      ring: "hover:border-warning/40",
    },

    finalizada: {
      label: "Finalizada",
      dot: "bg-success",
      badge: "bg-success/12 text-success border-success/30",
      ring: "hover:border-success/40",
    },
    cancelada: {
      label: "Cancelada",
      dot: "bg-foreground/50",
      badge: "bg-muted text-muted-foreground border-border",
      ring: "hover:border-border",
    },
  }[status];

  const nome = (cliente ?? "").trim() || "Sem cliente";
  const inicial = (nome[0] ?? "?").toUpperCase();
  const cor = cliente ? avatarColor(nome.toLowerCase()) : "bg-muted-foreground";

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className={`cursor-pointer text-left bg-card border border-border rounded-2xl p-4 transition active:scale-[0.99] md:hover:-translate-y-0.5 md:hover:shadow-lg ${STATUS.ring}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-12 shrink-0 rounded-full grid place-items-center text-white text-lg font-bold ${cor}`}
        >
          {inicial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold leading-tight truncate">{nome}</h3>
            <p className="font-display text-xl text-primary leading-none whitespace-nowrap">
              {brl(total)}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>
              {itens} {itens === 1 ? "item" : "itens"}
            </span>
            <span>·</span>
            <span>há {timeAgo(horario)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS.badge}`}
        >
          <span className={`size-1.5 rounded-full ${STATUS.dot}`} />
          {STATUS.label}
        </span>
        {garcomNome && (
          <span className="text-[11px] text-muted-foreground truncate">
            Garçom: <span className="text-foreground/80 font-medium">{garcomNome}</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/70 tracking-wider">
          #{String(numero).padStart(3, "0")}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-[11px] font-medium hover:bg-secondary"
          aria-label="Imprimir"
        >
          <Printer className="size-3.5" /> Imprimir
        </button>
      </div>
    </div>
  );
}
