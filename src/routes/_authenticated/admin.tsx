import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmDelete, handleDeleteError } from "@/lib/confirm";

import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Plus,
  Trash2,
  Loader2,
  TrendingUp,
  Trophy,
  CreditCard,
  Calendar,
  Clock,
  Search,
  Globe,
  ChefHat,
  CheckCircle2,
  Bell,
  Upload,
  Camera,
  ChevronDown,
  ImageIcon,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { toast } from "sonner";

import { EquipeTab } from "@/components/admin/EquipeTab";

import { CaixaTab } from "@/components/admin/CaixaTab";
import { RelatoriosTab } from "@/components/admin/RelatoriosTab";
import { EmpresaTab } from "@/components/admin/EmpresaTab";
import { AdicionaisTab } from "@/components/admin/AdicionaisTab";
import { PedidoOnlineTab } from "@/components/admin/PedidoOnlineTab";
import { DeliveryTab } from "@/components/admin/DeliveryTab";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import type { HorariosSemana } from "@/hooks/useConfig";
import { createClientId } from "@/lib/id";

export type TabKey =
  | "dashboard"
  | "produtos"
  | "categorias"
  | "adicionais"
  | "mesas"
  | "equipe"
  | "pin"
  | "online"
  | "delivery"
  | "caixa"
  | "relatorios"
  | "financeiro"
  | "taxas"
  | "operacao"
  | "config";

const TAB_TITLES: Record<TabKey, string> = {
  dashboard: "Dashboard",
  produtos: "Produtos",
  categorias: "Categorias",
  adicionais: "Personalização",
  mesas: "Comandas",
  equipe: "Usuários",
  pin: "PIN Diário",
  online: "Pedido Online",
  delivery: "Delivery & Retirada",
  caixa: "Caixa",
  relatorios: "Relatórios",
  financeiro: "Financeiro",
  taxas: "Taxas e Encargos",
  operacao: "Operação",
  config: "Cadastro da Empresa",
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Comanda" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab;
    if (typeof t === "string" && t in TAB_TITLES) return { tab: t as TabKey };
    return {};
  },
  component: AdminPage,
});

type Categoria = {
  id: string;
  nome: string;
  setor: "cozinha" | "bar" | "sobremesas";
  ativo: boolean;
  ordem: number;
};
type Produto = {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  imagem_url: string | null;
  categoria_id: string | null;
  ativo: boolean;
  exige_preparo: boolean;
  tem_adicionais?: boolean;
  exibir_online?: boolean;
  created_at?: string;
};
type Mesa = { id: string; numero: number; lugares: number; setor: string | null; status: string };

function AdminPage() {
  const { roles, empresa } = useAuth();
  const { tab } = Route.useSearch();
  const active: TabKey = tab ?? "dashboard";
  const [wizardOpen, setWizardOpen] = useState(false);
  useEffect(() => {
    if (empresa && !empresa.onboarding_completo) setWizardOpen(true);
  }, [empresa?.id, empresa?.onboarding_completo]);
  if (!roles.includes("admin") && !roles.includes("caixa")) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">Sem permissão</p>
      </div>
    );
  }
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="font-display text-3el md:text-4el mb-6">{TAB_TITLES[active]}</h1>
      {empresa && !empresa.onboarding_completo && (
        <Card className="mb-6 p-4 bg-amber-500/10 border-amber-500/40 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-medium text-amber-200">
              Existem configurações pendentes para concluir a implantação da empresa.
            </p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Finalize o assistente para liberar todos os recursos.
            </p>
          </div>
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            Concluir configuração
          </Button>
        </Card>
      )}
      {active === "dashboard" && <Dashboard />}
      {active === "produtos" && <ProdutosTab />}
      {active === "categorias" && <CategoriasTab />}
      {active === "adicionais" && <AdicionaisTab />}
      {active === "mesas" && <MesasTab />}
      {active === "equipe" && <EquipeTab />}
      {active === "pin" && <PinDiarioTab />}
      {active === "online" && <PedidoOnlineTab />}
      {active === "delivery" && <DeliveryTab />}
      {active === "caixa" && <CaixaTab />}
      {active === "relatorios" && <RelatoriosTab />}
      {active === "financeiro" && <FinanceiroTab />}
      {active === "taxas" && <TaxasTab />}
      {active === "operacao" && <OperacaoTab />}
      {active === "config" && <EmpresaTab />}
      <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

type DashStats = {
  vendasMes: number;
  ticketMedio: number;
  numPedidos: number;
  mediaComandas: number;
  produtoTop: { nome: string; qtd: number } | null;
  formaTop: { forma: string; pct: number } | null;
  melhorDia: { data: string; valor: number } | null;
  horaPico: { faixa: string; pedidos: number } | null;
};

type Pt = { name: string; value: number; pct?: number };
type Pt2 = { name: string; value: number; pct: number };
type SeriePt = { name: string; faturamento: number; pedidos: number; ticket: number };

// Paleta vibrante de alto contraste em tema escuro
const C = {
  azul: "#3B82F6", // faturamento
  verde: "#10B981", // crescimento / vendas
  amarelo: "#F59E0B", // alertas / pedidos
  roxo: "#8B5CF6", // comparativos / ticket
  laranja: "#F97316", // destaques
  rosa: "#EC4899", // extra
  ciano: "#06B6D4", // extra
};
const PIE_COLORS = [C.verde, C.azul, C.amarelo, C.roxo, C.laranja, C.rosa, C.ciano];
const AXIS = "#94a3b8"; // slate-400
const GRID = "rgba(148,163,184,0.18)";
const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(15, 15, 15, 0.95)",
  border: "1px solid rgba(148,163,184,0.35)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Cartão Débito",
  credito: "Cartão Crédito",
  outros: "Outros",
};

const EmptyChart = ({ height = 240 }: { height?: number }) => (
  <div
    className="grid place-items-center text-center border border-dashed border-border/60 rounded-lg"
    style={{ height }}
  >
    <div className="px-6">
      <p className="text-sm font-medium text-foreground/80">Sem dados suficientes</p>
      <p className="text-xs text-muted-foreground mt-1">
        Não existem informações suficientes para gerar este gráfico.
      </p>
    </div>
  </div>
);

type OnlineStatus =
  "novo" | "aceito" | "preparo" | "pronto" | "em_rota" | "finalizado" | "cancelado";
type UltimoPedido = {
  id: string;
  cliente_nome: string | null;
  total: number;
  status: string;
  aberta_em: string;
  origem: string;
  status_online: string | null;
};

function Dashboard() {
  const { empresa } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    vendasMes: 0,
    ticketMedio: 0,
    numPedidos: 0,
    emAndamento: 0,
  });
  const [topProdutos, setTopProdutos] = useState<Pt[]>([]);
  const [formasPag, setFormasPag] = useState<Pt2[]>([]);
  const [porHora, setPorHora] = useState<{ name: string; value: number }[]>([]);
  const [onlineCount, setOnlineCount] = useState<Record<OnlineStatus, number>>({
    novo: 0,
    aceito: 0,
    preparo: 0,
    pronto: 0,
    em_rota: 0,
    finalizado: 0,
    cancelado: 0,
  });
  const [ultimos, setUltimos] = useState<UltimoPedido[]>([]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pagsRes, pedidosRes, itensRes, onlineRes, comandasAbertasRes, ultimosRes] =
      await Promise.all([
        supabase
          .from("pagamentos")
          .select("valor, forma, created_at, comanda_id")
          .gte("created_at", inicioMes.toISOString()),
        supabase
          .from("pedidos")
          .select("id, created_at")
          .gte("created_at", inicioMes.toISOString()),
        supabase
          .from("itens_pedido")
          .select("produto_nome, quantidade, cancelado, created_at")
          .gte("created_at", inicioMes.toISOString())
          .eq("cancelado", false),
        supabase
          .from("comandas")
          .select("id, status_online, total, aberta_em, cliente_nome, origem")
          .eq("origem", "online")
          .gte(
            "aberta_em",
            new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          ),
        supabase.from("comandas").select("id").eq("status", "aberta"),
        supabase
          .from("comandas")
          .select("id, total, aberta_em, cliente_nome, origem, status_online, status")
          .order("aberta_em", { ascending: false })
          .limit(8),
      ]);

    const pags = (pagsRes.data ?? []) as {
      valor: number;
      forma: string;
      created_at: string;
      comanda_id: string;
    }[];
    const pedidos = (pedidosRes.data ?? []) as { id: string; created_at: string }[];
    const itens = (itensRes.data ?? []) as {
      produto_nome: string;
      quantidade: number;
      created_at: string;
    }[];
    const online = (onlineRes.data ?? []) as {
      status_online: string | null;
      total: number | null;
    }[];
    const abertas = (comandasAbertasRes.data ?? []) as { id: string }[];

    const vendasMes = pags.reduce((s, p) => s + Number(p.valor), 0);
    const comandasUnicas = new Set(pags.map((p) => p.comanda_id)).size;
    const ticketMedio = comandasUnicas ? vendasMes / comandasUnicas : 0;

    // Top produtos
    const prodAgg: Record<string, number> = {};
    itens.forEach((i) => {
      prodAgg[i.produto_nome] = (prodAgg[i.produto_nome] ?? 0) + i.quantidade;
    });
    const totalQtd = Object.values(prodAgg).reduce((s, v) => s + v, 0) || 1;
    setTopProdutos(
      Object.entries(prodAgg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value, pct: (value / totalQtd) * 100 })),
    );

    // Formas
    const formaAgg: Record<string, number> = {};
    pags.forEach((p) => {
      formaAgg[p.forma] = (formaAgg[p.forma] ?? 0) + Number(p.valor);
    });
    const totalForma = Object.values(formaAgg).reduce((s, v) => s + v, 0) || 1;
    setFormasPag(
      Object.entries(formaAgg)
        .map(([k, v]) => ({
          name: FORMA_LABEL[k] ?? k,
          value: v,
          pct: (v / totalForma) * 100,
        }))
        .sort((a, b) => b.value - a.value),
    );

    // Vendas por horário (0..23, mês corrente)
    const horas: Record<number, number> = {};
    for (let h = 0; h < 24; h++) horas[h] = 0;
    pags.forEach((p) => {
      const h = new Date(p.created_at).getHours();
      horas[h] += Number(p.valor);
    });
    setPorHora(
      Object.entries(horas).map(([h, v]) => ({
        name: `${String(h).padStart(2, "0")}h`,
        value: Math.round(v),
      })),
    );

    // Online status
    const counts: Record<OnlineStatus, number> = {
      novo: 0,
      aceito: 0,
      preparo: 0,
      pronto: 0,
      em_rota: 0,
      finalizado: 0,
      cancelado: 0,
    };
    online.forEach((o) => {
      const s = (o.status_online ?? "novo") as OnlineStatus;
      if (s in counts) counts[s] += 1;
    });
    setOnlineCount(counts);

    const naoFinal = online.filter(
      (o) => o.status_online && !["finalizado", "cancelado"].includes(o.status_online),
    ).length;
    setStats({
      vendasMes,
      ticketMedio,
      numPedidos: pedidos.length,
      emAndamento: abertas.length + naoFinal,
    });

    setUltimos((ultimosRes.data ?? []) as UltimoPedido[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!empresa?.id) return;
    void load();
  }, [empresa?.id]);
  useRealtime(["pagamentos", "pedidos", "comandas", "itens_pedido"], load, "admin-dash");

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const ambienteVazio =
    stats.vendasMes === 0 &&
    stats.numPedidos === 0 &&
    stats.emAndamento === 0 &&
    topProdutos.length === 0;
  if (ambienteVazio) {
    return (
      <Card className="p-8 md:p-10">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-display text-3el">Bem-vindo ao sistema</h2>
          <p className="text-muted-foreground text-base">
            Comece cadastrando seus produtos e configurando sua operação.
          </p>
        </div>
      </Card>
    );
  }

  const kpis = [
    {
      label: "Faturamento",
      value: brl(stats.vendasMes),
      icon: DollarSign,
      bar: C.verde,
      sub: "Total recebido no mês",
    },
    {
      label: "Pedidos",
      value: stats.numPedidos.toString(),
      icon: ShoppingBag,
      bar: C.amarelo,
      sub: "Pedidos no mês",
    },
    {
      label: "Ticket médio",
      value: brl(stats.ticketMedio),
      icon: TrendingUp,
      bar: C.azul,
      sub: "Faturamento ÷ comandas",
    },
    {
      label: "Pedidos em andamento",
      value: stats.emAndamento.toString(),
      icon: ChefHat,
      bar: C.laranja,
      sub: "Abertos + online ativos",
    },
  ];

  const painelOnline: { label: string; key: OnlineStatus; bar: string }[] = [
    { label: "Novos", key: "novo", bar: C.amarelo },
    { label: "Aceitos", key: "aceito", bar: C.azul },
    { label: "Em preparo", key: "preparo", bar: C.laranja },
    { label: "Em rota", key: "em_rota", bar: C.roxo },
    { label: "Finalizados", key: "finalizado", bar: C.verde },
    { label: "Cancelados", key: "cancelado", bar: C.rosa },
  ];

  type TPayload = {
    name?: string;
    value?: number;
    color?: string;
    payload?: Record<string, unknown>;
  }[];
  const TooltipProduto = ({ active, payload }: { active?: boolean; payload?: TPayload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { name: string; value: number; pct?: number };
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
        <div>
          Quantidade: <strong>{p.value}</strong>
        </div>
        {p.pct != null && (
          <div>
            Participação: <strong>{p.pct.toFixed(1)}%</strong>
          </div>
        )}
      </div>
    );
  };
  const TooltipHora = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TPayload;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div>
          Faturamento: <strong>{brl(payload[0].value ?? 0)}</strong>
        </div>
      </div>
    );
  };
  const TooltipForma = ({ active, payload }: { active?: boolean; payload?: TPayload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as Pt2;
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
        <div>
          Valor: <strong>{brl(p.value)}</strong>
        </div>
        <div>
          Participação: <strong>{p.pct.toFixed(1)}%</strong>
        </div>
      </div>
    );
  };

  const statusLabel = (u: UltimoPedido) => {
    if (u.origem === "online" && u.status_online) return u.status_online.replace("_", " ");
    return u.status ?? "—";
  };

  return (
    <div className="space-y-4">
      {/* LINHA 1 — KPIs grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((c) => (
          <Card key={c.label} className="p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full" style={{ background: c.bar }} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {c.label}
              </span>
              <div
                className="size-11 rounded-xl grid place-items-center"
                style={{ background: `${c.bar}22`, color: c.bar }}
              >
                <c.icon className="size-6" />
              </div>
            </div>
            <p className="font-display text-4el leading-none" style={{ color: c.bar }}>
              {c.value}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{c.sub}</p>
          </Card>
        ))}
      </div>

      {/* LINHA 2 — Dois gráficos grandes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg">Produtos mais vendidos</h3>
              <p className="text-xs text-muted-foreground">Quantidade vendida no mês.</p>
            </div>
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ background: `${C.verde}22`, color: C.verde }}
            >
              Top {Math.min(topProdutos.length, 8)}
            </span>
          </div>
          {topProdutos.length === 0 ? (
            <EmptyChart height={420} />
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={topProdutos}
                layout="vertical"
                margin={{ top: 8, right: 56, left: 8, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" stroke={AXIS} fontSize={11} />
                <YAxis type="category" dataKey="name" stroke={AXIS} fontSize={12} width={140} />
                <Tooltip content={<TooltipProduto />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" fill={C.verde} radius={[0, 8, 8, 0]} maxBarSize={32}>
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="#fff"
                    fontSize={11}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg">Vendas por horário</h3>
              <p className="text-xs text-muted-foreground">
                Faturamento por hora do dia (mês corrente).
              </p>
            </div>
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded"
              style={{ background: `${C.azul}22`, color: C.azul }}
            >
              24h
            </span>
          </div>
          {porHora.every((v) => v.value === 0) ? (
            <EmptyChart height={420} />
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={porHora} margin={{ top: 16, right: 16, left: 8, bottom: 20 }}>
                <defs>
                  <linearGradient id="gradHora" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.azul} stopOpacity={1} />
                    <stop offset="100%" stopColor={C.azul} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="name" stroke={AXIS} fontSize={10} interval={1} />
                <YAxis
                  stroke={AXIS}
                  fontSize={11}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v}`
                  }
                />
                <Tooltip content={<TooltipHora />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" fill="url(#gradHora)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* LINHA 3 — Painel Pedidos Online */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <div
            className="size-9 rounded-lg grid place-items-center"
            style={{ background: `${C.ciano}22`, color: C.ciano }}
          >
            <Globe className="size-5" />
          </div>
          <div>
            <h3 className="font-display text-lg">Pedidos Online — Hoje</h3>
            <p className="text-xs text-muted-foreground">
              Distribuição dos pedidos recebidos pelo link público.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {painelOnline.map((p) => (
            <Card key={p.key} className="p-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 w-full" style={{ background: p.bar }} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {p.label}
              </span>
              <p className="font-display text-3el mt-1" style={{ color: p.bar }}>
                {onlineCount[p.key]}
              </p>
            </Card>
          ))}
        </div>
      </Card>

      {/* LINHA 4 — Pagamentos + Últimos pedidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="mb-3">
            <h3 className="font-display text-lg">Formas de pagamento</h3>
            <p className="text-xs text-muted-foreground">Distribuição dos recebimentos no mês.</p>
          </div>
          {formasPag.length === 0 ? (
            <EmptyChart height={360} />
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <PieChart margin={{ top: 16, right: 32, bottom: 8, left: 32 }}>
                <Pie
                  data={formasPag}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={110}
                  paddingAngle={3}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={2}
                  label={(e: { pct?: number }) => `${(e.pct ?? 0).toFixed(0)}%`}
                  labelLine={{ stroke: AXIS }}
                >
                  {formasPag.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<TooltipForma />} />
                <Legend
                  verticalAlign="bottom"
                  height={48}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12, color: "#e2e8f0" }}
                  formatter={(v, e) => {
                    const item = e?.payload as Pt2 | undefined;
                    if (!item) return v;
                    return `${v} — ${item.pct.toFixed(1)}% · ${brl(item.value)}`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3">
            <h3 className="font-display text-lg">Últimos pedidos</h3>
            <p className="text-xs text-muted-foreground">Movimentações mais recentes.</p>
          </div>
          {ultimos.length === 0 ? (
            <EmptyChart height={360} />
          ) : (
            <div
              className="divide-t divide-border/50"
              style={{ maxHeight: 360, overflowY: "auto" }}
            >
              {ultimos.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {u.cliente_nome || (u.origem === "online" ? "Cliente online" : "Comanda")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(u.aberta_em).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      <span className="capitalize">{statusLabel(u)}</span>
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0" style={{ color: C.verde }}>
                    {brl(Number(u.total ?? 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProdutosTab() {
  const [prods, setProds] = useState<Produto[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [form, setForm] = useState<Partial<Produto>>({ ativo: true, exibir_online: true });
  const [open, setOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [catSel, setCatSel] = useState<string>("todas");
  const [statusSel, setStatusSel] = useState<
    "todos" | "ativos" | "inativos" | "online_sim" | "online_nao"
  >("todos");
  const [faixaSel, setFaixaSel] = useState<"todas" | "ate10" | "10a20" | "20a50" | "acima50">(
    "todas",
  );
  const [ordem, setOrdem] = useState<"az" | "za" | "menor" | "maior" | "recentes">("az");

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("produtos").select("*").order("nome"),
      supabase.from("categorias").select("*").order("ordem"),
    ]);
    setProds((p ?? []) as Produto[]);
    setCats((c ?? []) as Categoria[]);
  };
  useEffect(() => {
    load();
  }, []);

  const del = async (id: string) => {
    if (!(await confirmDelete())) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    load();
  };

  const catNome = (id: string | null) => cats.find((c) => c.id === id)?.nome ?? "Sem categoria";
  const contagemPorCat = useMemo(() => {
    const m: Record<string, number> = {};
    prods.forEach((p) => {
      const k = p.categoria_id ?? "_sem";
      m[k] = (m[k] ?? 0) + 1;
    });
    return m;
  }, [prods]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = prods.filter((p) => {
      if (catSel !== "todas" && (p.categoria_id ?? "_sem") !== catSel) return false;
      if (statusSel === "ativos" && !p.ativo) return false;
      if (statusSel === "inativos" && p.ativo) return false;
      if (statusSel === "online_sim" && !(p.exibir_online ?? true)) return false;
      if (statusSel === "online_nao" && (p.exibir_online ?? true)) return false;
      if (faixaSel === "ate10" && p.preco > 10) return false;
      if (faixaSel === "10a20" && (p.preco < 10 || p.preco > 20)) return false;
      if (faixaSel === "20a50" && (p.preco < 20 || p.preco > 50)) return false;
      if (faixaSel === "acima50" && p.preco <= 50) return false;
      if (q) {
        const cat = catNome(p.categoria_id).toLowerCase();
        if (
          !p.nome.toLowerCase().includes(q) &&
          !cat.includes(q) &&
          !p.id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (ordem === "az") return a.nome.localeCompare(b.nome);
      if (ordem === "za") return b.nome.localeCompare(a.nome);
      if (ordem === "menor") return a.preco - b.preco;
      if (ordem === "maior") return b.preco - a.preco;
      if (ordem === "recentes") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      return 0;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prods, cats, busca, catSel, statusSel, faixaSel, ordem]);

  return (
    <div className="space-y-3">
      {/* Linha 1: busca + novo */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-t-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Buscar por nome, categoria ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setForm({ ativo: true, exibir_online: true, exige_preparo: true })}
            >
              <Plus className="size-4 mr-1" />
              Novo produto
            </Button>
          </DialogTrigger>
          <ProdutoDialog
            open={open}
            form={form}
            setForm={setForm}
            cats={cats}
            onSaved={() => {
              setOpen(false);
              setForm({ ativo: true, exibir_online: true, exige_preparo: true });
              load();
            }}
          />
        </Dialog>
      </div>

      {/* Linha 2: categorias */}
      <div className="flex gap-2 overflow-e-auto pb-1">
        <button
          onClick={() => setCatSel("todas")}
          className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap border transition ${catSel === "todas" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
        >
          TODOS ({prods.length})
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatSel(c.id)}
            className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap border transition uppercase ${catSel === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            {c.nome} ({contagemPorCat[c.id] ?? 0})
          </button>
        ))}
        {(contagemPorCat["_sem"] ?? 0) > 0 && (
          <button
            onClick={() => setCatSel("_sem")}
            className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap border transition ${catSel === "_sem" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            SEM CATEGORIA ({contagemPorCat["_sem"]})
          </button>
        )}
      </div>

      {/* Linha 3: status, faixa, ordenação */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={statusSel} onValueChange={(v) => setStatusSel(v as typeof statusSel)}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="online_sim">Visíveis no Online</SelectItem>
            <SelectItem value="online_nao">Ocultos do Online</SelectItem>
          </SelectContent>
        </Select>
        <Select value={faixaSel} onValueChange={(v) => setFaixaSel(v as typeof faixaSel)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faixas</SelectItem>
            <SelectItem value="ate10">Até R$ 10,00</SelectItem>
            <SelectItem value="10a20">R$ 10,00 a R$ 20,00</SelectItem>
            <SelectItem value="20a50">R$ 20,00 a R$ 50,00</SelectItem>
            <SelectItem value="acima50">Acima de R$ 50,00</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="az">Nome A → Z</SelectItem>
            <SelectItem value="za">Nome Z → A</SelectItem>
            <SelectItem value="menor">Menor preço</SelectItem>
            <SelectItem value="maior">Maior preço</SelectItem>
            <SelectItem value="recentes">Últimos cadastrados</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtrados.length} de {prods.length} produtos
        </p>
      </div>

      {/* Lista compacta */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {filtrados.map((p) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate leading-tight">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {catNome(p.categoria_id)}
                </p>
                <p className="text-primary font-semibold mt-0.5">{brl(p.preco)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={p.ativo ? "default" : "secondary"} className="text-[10px]">
                  {p.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <Badge
                  variant={(p.exibir_online ?? true) ? "outline" : "secondary"}
                  className="text-[10px]"
                >
                  Online: {(p.exibir_online ?? true) ? "Sim" : "Não"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-1 mt-2 -mb-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={() => {
                  setForm(p);
                  setOpen(true);
                }}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive px-2 ml-auto"
                onClick={() => del(p.id)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </Card>
        ))}
        {filtrados.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground py-12">
            Nenhum produto encontrado
          </p>
        )}
      </div>
    </div>
  );
}

type GrupoAdicional = { id: string; nome: string; ativo: boolean };

function ProdutoDialog({
  open,
  form,
  setForm,
  cats,
  onSaved,
}: {
  open: boolean;
  form: Partial<Produto>;
  setForm: (f: Partial<Produto>) => void;
  cats: Categoria[];
  onSaved: () => void;
}) {
  const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);
  const [gruposSel, setGruposSel] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    (async () => {
      const { data: g } = await supabase
        .from("grupos_adicionais")
        .select("id,nome,ativo")
        .eq("ativo", true)
        .order("ordem");
      setGrupos((g ?? []) as GrupoAdicional[]);
      if (form.id) {
        const { data: pg } = await supabase
          .from("produto_grupos_adicionais")
          .select("grupo_id")
          .eq("produto_id", form.id);
        setGruposSel(new Set((pg ?? []).map((r) => r.grupo_id as string)));
      } else {
        setGruposSel(new Set());
      }
    })();
  }, [open, form.id]);

  const toggleGrupo = (id: string) => {
    const n = new Set(gruposSel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setGruposSel(n);
  };

  const handleUpload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem acima de 5MB");
      return;
    }
    setUploading(true);
    try {
      const { data: empresaId, error: empresaError } = await supabase.rpc("minha_empresa_id");
      if (empresaError || !empresaId) {
        throw new Error("Nao foi possivel identificar a empresa");
      }
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${empresaId}/${createClientId()}.${ext}`;
      const up = await supabase.storage
        .from("produtos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const signed = await supabase.storage
        .from("produtos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed.error) throw signed.error;
      setForm({ ...form, imagem_url: signed.data.signedUrl });
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (camRef.current) camRef.current.value = "";
    }
  };

  const save = async () => {
    if (!form.nome || !form.preco) {
      toast.error("Nome e preço obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome,
      preco: Number(form.preco),
      categoria_id: form.categoria_id ?? null,
      descricao: form.descricao ?? null,
      imagem_url: form.imagem_url ?? null,
      ativo: form.ativo ?? true,
      exige_preparo: form.exige_preparo ?? true,
      tem_adicionais: form.tem_adicionais ?? false,
      exibir_online: form.exibir_online ?? true,
    };
    const res = form.id
      ? await supabase.from("produtos").update(payload).eq("id", form.id).select("id").maybeSingle()
      : await supabase.from("produtos").insert(payload).select("id").maybeSingle();
    if (res.error || !res.data) {
      setSaving(false);
      toast.error(res.error?.message ?? "Erro ao salvar");
      return;
    }
    const produtoId = res.data.id as string;

    if (form.tem_adicionais) {
      const { data: atuais } = await supabase
        .from("produto_grupos_adicionais")
        .select("id,grupo_id")
        .eq("produto_id", produtoId);
      const atuaisMap = new Map((atuais ?? []).map((r) => [r.grupo_id as string, r.id as string]));
      const toDelete = [...atuaisMap.entries()]
        .filter(([g]) => !gruposSel.has(g))
        .map(([, id]) => id);
      const toInsert = [...gruposSel].filter((g) => !atuaisMap.has(g));
      if (toDelete.length)
        await supabase.from("produto_grupos_adicionais").delete().in("id", toDelete);
      if (toInsert.length) {
        const empresa_id = (await supabase.rpc("minha_empresa_id")).data as string;
        await supabase.from("produto_grupos_adicionais").insert(
          toInsert.map((grupo_id, i) => ({
            produto_id: produtoId,
            grupo_id,
            ordem: i,
            empresa_id,
          })),
        );
      }
    } else {
      await supabase.from("produto_grupos_adicionais").delete().eq("produto_id", produtoId);
    }
    setSaving(false);
    toast.success("Produto salvo");
    onSaved();
  };

  const personalizavel = form.tem_adicionais ?? false;

  return (
    <DialogContent className="sm:max-w-5xl max-h-[85vh] p-0 gap-0 flex flex-col">
      <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
        <DialogTitle>{form.id ? "Editar" : "Novo"} produto</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          {/* Coluna imagem + toggles */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Imagem</Label>
              <div className="mt-1 aspect-square w-full rounded-md border border-border bg-muted/40 grid place-items-center overflow-hidden">
                {form.imagem_url ? (
                  <img src={form.imagem_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => handleUpload(e.target.files?.[0])}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="size-4 mr-1" />
                  )}
                  Enviar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => camRef.current?.click()}
                >
                  <Camera className="size-4 mr-1" />
                  Foto
                </Button>
              </div>
              {form.imagem_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full mt-1 text-destructive"
                  onClick={() => setForm({ ...form, imagem_url: null })}
                >
                  <X className="size-4 mr-1" />
                  Remover imagem
                </Button>
              )}
            </div>

            <div className="space-y-1.5 py-1">
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 gap-2 cursor-pointer">
                <span className="text-xs">Exibir no pedido online</span>
                <Switch
                  checked={form.exibir_online ?? true}
                  onCheckedChange={(v) => setForm({ ...form, exibir_online: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 gap-2 cursor-pointer">
                <span className="text-xs">Exige preparo</span>
                <Switch
                  checked={form.exige_preparo ?? true}
                  onCheckedChange={(v) => setForm({ ...form, exige_preparo: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 gap-2 cursor-pointer">
                <span className="text-xs">Personalizável</span>
                <Switch
                  checked={personalizavel}
                  onCheckedChange={(v) => setForm({ ...form, tem_adicionais: v })}
                />
              </label>
              <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 gap-2 cursor-pointer">
                <span className="text-xs">Produto ativo</span>
                <Switch
                  checked={form.ativo ?? true}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
              </label>
            </div>
          </div>

          {/* Coluna dados principais */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-3">
                <Label>Nome do produto</Label>
                <Input
                  autoFocus
                  value={form.nome ?? ""}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Marmita de Frango"
                />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco ?? ""}
                  onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
                  placeholder="0,00"
                />
              </div>
              <div className="lg:col-span-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria_id ?? ""}
                  onValueChange={(v) => setForm({ ...form, categoria_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Descrição (opcional)</Label>
                <span className="text-[11px] text-muted-foreground">
                  {(form.descricao ?? "").length}/160
                </span>
              </div>
              <Textarea
                rows={2}
                maxLength={160}
                value={form.descricao ?? ""}
                onChange={(e) => setForm({ ...form, descricao: e.target.value.slice(0, 160) })}
                placeholder="Ex.: Filé de tilápia com arroz, feijão e batata frita."
                className="resize-none"
              />
            </div>

            {personalizavel && (
              <div className="rounded-md border border-border p-3">
                <Label className="text-sm">Grupos de adicionais</Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Selecione os grupos deste produto.
                </p>
                {grupos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum grupo cadastrado. Crie em "Personalização".
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {grupos.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={gruposSel.has(g.id)}
                          onCheckedChange={() => toggleGrupo(g.id)}
                        />
                        <span className="truncate">{g.nome}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-background">
        <Button onClick={save} disabled={saving || uploading} className="min-w-[140px]">
          {saving && <Loader2 className="size-4 mr-1 animate-spin" />}Salvar produto
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CategoriasTab() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState<"cozinha" | "bar" | "sobremesas">("cozinha");
  const load = async () => {
    const { data } = await supabase.from("categorias").select("*").order("ordem");
    setCats((data ?? []) as Categoria[]);
  };
  useEffect(() => {
    load();
  }, []);
  const add = async () => {
    if (!nome) return;
    await supabase.from("categorias").insert({ nome, setor, ordem: cats.length + 1 });
    setNome("");
    load();
  };
  const del = async (id: string) => {
    if (!(await confirmDelete())) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    load();
  };

  return (
    <div>
      <Card className="p-3 mb-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Massas" />
          </div>
          <div>
            <Label>Setor</Label>
            <Select value={setor} onValueChange={(v) => setSetor(v as typeof setor)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cozinha">Cozinha</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="sobremesas">Sobremesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add}>
            <Plus className="size-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {cats.map((c) => (
          <Card key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{c.nome}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{c.setor}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-destructive shrink-0"
              onClick={() => del(c.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MesasTab() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [numero, setNumero] = useState("");
  const [lugares, setLugares] = useState("4");
  const [setor, setSetor] = useState("");
  const load = async () => {
    const { data } = await supabase.from("mesas").select("*").order("numero");
    setMesas((data ?? []) as Mesa[]);
  };
  useEffect(() => {
    load();
  }, []);
  const add = async () => {
    if (!numero) return;
    const { error } = await supabase
      .from("mesas")
      .insert({ numero: Number(numero), lugares: Number(lugares) || 4, setor: setor || null });
    if (error) toast.error(error.message);
    else {
      setNumero("");
      setSetor("");
      load();
    }
  };
  const del = async (id: string) => {
    if (!(await confirmDelete())) return;
    const { error } = await supabase.from("mesas").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-3">
        <h2 className="font-display text-xl">Gestão de Comandas</h2>
        <p className="text-xs text-muted-foreground">
          Cadastre cada posição de comanda (mesa, balcão, delivery, etc).
        </p>
      </div>
      <Card className="p-4 mb-4 flex gap-2 items-end flex-wrap">
        <div>
          <Label>Número</Label>
          <Input className="w-24" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <div>
          <Label>Lugares</Label>
          <Input className="w-24" value={lugares} onChange={(e) => setLugares(e.target.value)} />
        </div>
        <div>
          <Label>Setor</Label>
          <Input value={setor} onChange={(e) => setSetor(e.target.value)} placeholder="Salão" />
        </div>
        <Button onClick={add}>
          <Plus className="size-4 mr-1" />
          Adicionar
        </Button>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {mesas.map((m) => (
          <Card key={m.id} className="p-3 text-center relative">
            <p className="font-display text-3el">{m.numero}</p>
            <p className="text-xs text-muted-foreground">{m.lugares} lugares</p>
            {m.setor && <p className="text-xs">{m.setor}</p>}
            <Badge variant="outline" className="mt-2 capitalize text-xs">
              {m.status}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 size-7 text-destructive"
              onClick={() => del(m.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FinanceiroTab() {
  const [pags, setPags] = useState<
    { id: string; forma: string; valor: number; cliente_nome: string | null; created_at: string }[]
  >([]);
  const load = async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("pagamentos")
      .select("*")
      .gte("created_at", hoje.toISOString())
      .order("created_at", { ascending: false });
    setPags((data ?? []) as typeof pags);
  };
  useEffect(() => {
    load();
  }, []);
  const total = pags.reduce((s, p) => s + Number(p.valor), 0);
  const porForma = pags.reduce<Record<string, number>>((a, p) => {
    a[p.forma] = (a[p.forma] ?? 0) + Number(p.valor);
    return a;
  }, {});
  return (
    <div>
      <Card className="p-5 mb-4">
        <p className="text-xs text-muted-foreground uppercase">Total recebido hoje</p>
        <p className="font-display text-4el text-success">{brl(total)}</p>
        <div className="flex gap-4 mt-3 flex-wrap text-sm">
          {Object.entries(porForma).map(([f, v]) => (
            <div key={f}>
              <span className="capitalize text-muted-foreground">{f}:</span>{" "}
              <span className="font-semibold">{brl(v)}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-2">
        {pags.map((p) => (
          <Card key={p.id} className="p-3 flex justify-between items-center text-sm">
            <div>
              <Badge variant="outline" className="capitalize mr-2">
                {p.forma}
              </Badge>
              {p.cliente_nome && <span className="text-muted-foreground">{p.cliente_nome}</span>}
            </div>
            <span className="font-semibold text-primary">{brl(p.valor)}</span>
          </Card>
        ))}
        {pags.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum pagamento hoje</p>
        )}
      </div>
    </div>
  );
}

type Configuracoes = {
  id: string;
  taxa_garcom_ativa: boolean;
  taxa_garcom_percentual: number;
  taxa_garcom_auto: boolean;
  couvert_ativo: boolean;
  couvert_valor: number;
};

function TaxasTab() {
  const [cfg, setCfg] = useState<Configuracoes | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.rpc("get_configuracoes_completo");
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setCfg(row as Configuracoes | null);
  };
  useEffect(() => {
    load();
  }, []);
  if (!cfg)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  const salvar = async (patch: Partial<Configuracoes>) => {
    setBusy(true);
    const novo = { ...cfg, ...patch };
    setCfg(novo);
    const { error } = await supabase.from("configuracoes").update(patch).eq("id", cfg.id);
    if (error) {
      toast.error(error.message);
      setCfg(cfg);
    }
    setBusy(false);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl">Taxa de Garçom</h2>
            <p className="text-xs text-muted-foreground">Calculada sobre o subtotal da comanda.</p>
          </div>
          <Switch
            checked={cfg.taxa_garcom_ativa}
            disabled={busy}
            onCheckedChange={(v) => salvar({ taxa_garcom_ativa: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Percentual (%)</Label>
            <Input
              type="number"
              step="0.5"
              min={0}
              max={100}
              disabled={!cfg.taxa_garcom_ativa || busy}
              value={cfg.taxa_garcom_percentual}
              onChange={(e) => setCfg({ ...cfg, taxa_garcom_percentual: Number(e.target.value) })}
              onBlur={() => salvar({ taxa_garcom_percentual: Number(cfg.taxa_garcom_percentual) })}
            />
          </div>
          <div className="flex items-end justify-between rounded-md border border-border p-3">
            <div>
              <Label className="text-sm">Aplicar automaticamente</Label>
              <p className="text-[11px] text-muted-foreground">No fechamento da comanda</p>
            </div>
            <Switch
              checked={cfg.taxa_garcom_auto}
              disabled={!cfg.taxa_garcom_ativa || busy}
              onCheckedChange={(v) => salvar({ taxa_garcom_auto: v })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl">Couvert Artístico</h2>
            <p className="text-xs text-muted-foreground">
              Valor fixo por pessoa. Aplicação opcional por comanda.
            </p>
          </div>
          <Switch
            checked={cfg.couvert_ativo}
            disabled={busy}
            onCheckedChange={(v) => salvar({ couvert_ativo: v })}
          />
        </div>
        <div>
          <Label>Valor por pessoa (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            disabled={!cfg.couvert_ativo || busy}
            value={cfg.couvert_valor}
            onChange={(e) => setCfg({ ...cfg, couvert_valor: Number(e.target.value) })}
            onBlur={() => salvar({ couvert_valor: Number(cfg.couvert_valor) })}
          />
        </div>
      </Card>
    </div>
  );
}

type OperacaoCfg = {
  id: string;
  modo_operacao: "mesas" | "comandas" | "ambos";
  horario_ativo: boolean;
  horarios: HorariosSemana;
  pin_diario_ativo: boolean;
  qtd_comandas: number;
  tipo_numeracao: "continua" | "diaria" | "mensal";
};

function OperacaoTab() {
  const [cfg, setCfg] = useState<OperacaoCfg | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_configuracoes_completo");
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setCfg(row as unknown as OperacaoCfg | null);
  };
  useEffect(() => {
    load();
  }, []);
  if (!cfg)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  const salvar = async (patch: Partial<OperacaoCfg>) => {
    setBusy(true);
    const novo = { ...cfg, ...patch };
    setCfg(novo);
    const { error } = await supabase
      .from("configuracoes")
      .update(patch as never)
      .eq("id", cfg.id);
    if (error) {
      toast.error(error.message);
      setCfg(cfg);
    } else {
      toast.success("Configuração salva");
    }
    setBusy(false);
  };

  const DIAS: { k: keyof OperacaoCfg["horarios"]; label: string }[] = [
    { k: "dom", label: "Domingo" },
    { k: "seg", label: "Segunda" },
    { k: "ter", label: "Terça" },
    { k: "qua", label: "Quarta" },
    { k: "qui", label: "Quinta" },
    { k: "sex", label: "Sexta" },
    { k: "sab", label: "Sábado" },
  ];

  const updateDia = (
    k: keyof OperacaoCfg["horarios"],
    patch: Partial<OperacaoCfg["horarios"][keyof OperacaoCfg["horarios"]]>,
  ) => {
    const horarios = { ...cfg.horarios, [k]: { ...cfg.horarios[k], ...patch } };
    setCfg({ ...cfg, horarios });
  };
  const normalizarHorario = (valor: string) => {
    const partes = valor.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!partes) return valor;
    return `${partes[1].padStart(2, "0")}:${partes[2]}`;
  };
  const horarioValido = (valor: string) => {
    const partes = valor.match(/^(\d{2}):(\d{2})$/);
    return !!partes && Number(partes[1]) <= 23 && Number(partes[2]) <= 59;
  };
  const salvarHorarios = () => {
    const invalido = DIAS.find(({ k }) => {
      const dia = cfg.horarios[k];
      return dia.aberto && (!horarioValido(dia.abre) || !horarioValido(dia.fecha));
    });
    if (invalido) {
      toast.error(`Informe um hor?rio v?lido em ${invalido.label}, no formato 08:00 ou 23:30.`);
      return;
    }
    salvar({ horarios: cfg.horarios });
  };

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <ComandasPoolCard cfg={cfg} setCfg={setCfg} busy={busy} salvar={salvar} />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Horário</h2>
          <Switch
            checked={cfg.horario_ativo}
            disabled={busy}
            onCheckedChange={(v) => salvar({ horario_ativo: v })}
          />
        </div>
        <div className="space-y-1.5">
          {DIAS.map((d) => {
            const h = cfg.horarios?.[d.k] ?? { aberto: false, abre: "08:00", fecha: "23:00" };
            return (
              <div
                key={d.k}
                className="grid grid-cols-[90px_auto_1fr_auto_1fr] gap-2 items-center py-1"
              >
                <span className="text-sm font-medium">{d.label}</span>
                <Switch
                  checked={!!h.aberto}
                  disabled={busy}
                  onCheckedChange={(v) => updateDia(d.k, { aberto: v })}
                />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="08:00"
                  maxLength={5}
                  value={h.abre ?? "08:00"}
                  disabled={!h.aberto}
                  onChange={(e) => updateDia(d.k, { abre: e.target.value.replace(/[^0-9:]/g, "") })}
                  onBlur={(e) => updateDia(d.k, { abre: normalizarHorario(e.target.value) })}
                  className="h-8 font-mono tabular-nums"
                />
                <span className="text-muted-foreground text-xs">→</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="08:00"
                  maxLength={5}
                  value={h.fecha ?? "23:00"}
                  disabled={!h.aberto}
                  onChange={(e) =>
                    updateDia(d.k, { fecha: e.target.value.replace(/[^0-9:]/g, "") })
                  }
                  onBlur={(e) => updateDia(d.k, { fecha: normalizarHorario(e.target.value) })}
                  className="h-8 font-mono tabular-nums"
                />
              </div>
            );
          })}
        </div>
        <Button className="mt-4 w-full" disabled={busy} onClick={salvarHorarios}>
          Salvar Configuração
        </Button>
      </Card>
    </div>
  );
}

function PinDiarioTab() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<{ id: string; pin_diario_ativo: boolean } | null>(null);
  const [pinHoje, setPinHoje] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.rpc("get_configuracoes_completo");
    const row = Array.isArray(data) ? data[0] : data;
    if (row)
      setCfg({
        id: (row as { id: string }).id,
        pin_diario_ativo: !!(row as { pin_diario_ativo: boolean }).pin_diario_ativo,
      });
  };
  const loadPin = async () => {
    const { hojeISO } = await import("@/lib/horario");
    const { data } = await supabase
      .from("pin_diario")
      .select("pin")
      .eq("data", hojeISO())
      .maybeSingle();
    setPinHoje(data?.pin ?? null);
  };
  useEffect(() => {
    load();
    loadPin();
  }, []);
  if (!cfg)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  const toggle = async (v: boolean) => {
    setBusy(true);
    const prev = cfg;
    setCfg({ ...cfg, pin_diario_ativo: v });
    const { error } = await supabase
      .from("configuracoes")
      .update({ pin_diario_ativo: v })
      .eq("id", cfg.id);
    if (error) {
      toast.error(error.message);
      setCfg(prev);
    } else toast.success("Configuração salva");
    setBusy(false);
  };

  const gerarPin = async () => {
    setPinBusy(true);
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const { hojeISO } = await import("@/lib/horario");
    const { data: prof } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("id", user?.id ?? "")
      .maybeSingle();
    const empresa_id = (prof as { empresa_id?: string } | null)?.empresa_id ?? null;
    if (!empresa_id) {
      setPinBusy(false);
      toast.error("Empresa não encontrada");
      return;
    }
    const { error } = await supabase
      .from("pin_diario")
      .upsert(
        { data: hojeISO(), pin, criado_por: user?.id ?? null, empresa_id },
        { onConflict: "empresa_id,data" },
      );
    setPinBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPinHoje(pin);
    toast.success("PIN do dia gerado");
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl">PIN Diário</h2>
            <p className="text-xs text-muted-foreground">
              Quando ativo, o garçom precisa informar o PIN do dia para acessar. Gere um novo código
              a cada turno e comunique a equipe.
            </p>
          </div>
          <Switch checked={cfg.pin_diario_ativo} disabled={busy} onCheckedChange={toggle} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs">PIN de hoje</Label>
            <div className="font-display text-3el tracking-[0.4em] text-primary">
              {pinHoje ?? "—"}
            </div>
          </div>
          <Button onClick={gerarPin} disabled={pinBusy}>
            {pinBusy && <Loader2 className="size-4 animate-spin mr-2" />}
            {pinHoje ? "Gerar novo" : "Gerar PIN"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ComandasPoolCard({
  cfg,
  setCfg,
  busy,
  salvar,
}: {
  cfg: OperacaoCfg;
  setCfg: (c: OperacaoCfg) => void;
  busy: boolean;
  salvar: (patch: Partial<OperacaoCfg>) => Promise<void>;
}) {
  const [poolBusy, setPoolBusy] = useState(false);
  const [stats, setStats] = useState<{ total: number; emUso: number }>({ total: 0, emUso: 0 });

  const loadStats = async () => {
    const [{ count: total }, { count: emUso }] = await Promise.all([
      supabase.from("mesas").select("id", { count: "exact", head: true }),
      supabase.from("mesas").select("id", { count: "exact", head: true }).neq("status", "livre"),
    ]);
    setStats({ total: total ?? 0, emUso: emUso ?? 0 });
  };
  useEffect(() => {
    loadStats();
  }, []);

  const persistirTipo = async (tipo: OperacaoCfg["tipo_numeracao"]) => {
    setCfg({ ...cfg, tipo_numeracao: tipo });
    await salvar({ tipo_numeracao: tipo });
  };

  const salvarConfig = async () => {
    setPoolBusy(true);
    await salvar({ qtd_comandas: cfg.qtd_comandas, tipo_numeracao: cfg.tipo_numeracao });
    const { data, error } = await supabase.rpc("regenerar_pool_comandas", {
      _qtd: cfg.qtd_comandas,
    });
    setPoolBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as unknown as {
      total: number;
      removidas: number;
      solicitado: number;
    } | null;
    if (result && result.total > result.solicitado) {
      toast.info("Algumas comandas com histórico foram mantidas.");
    }
    loadStats();
  };

  const OPCOES_QTD = [20, 50, 100, 200];
  const disponiveis = Math.max(0, stats.total - stats.emUso);
  const pct = stats.total > 0 ? Math.min(100, (stats.emUso / stats.total) * 100) : 0;

  return (
    <Card className="p-5 space-y-5">
      <h2 className="font-display text-xl">Comandas</h2>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-muted-foreground">Pool</span>
          <span className="text-sm">
            <span className="font-display text-lg">{disponiveis}</span>
            <span className="text-muted-foreground"> / {stats.total} disponíveis</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div>
        <Label className="text-sm">Quantidade máeima</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {OPCOES_QTD.map((q) => (
            <Button
              key={q}
              type="button"
              size="sm"
              variant={cfg.qtd_comandas === q ? "default" : "outline"}
              onClick={() => setCfg({ ...cfg, qtd_comandas: q })}
            >
              {q}
            </Button>
          ))}
          <Input
            type="number"
            min={1}
            max={999}
            value={cfg.qtd_comandas}
            onChange={(e) =>
              setCfg({
                ...cfg,
                qtd_comandas: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
              })
            }
            className="w-[90px] h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-sm">Numeração</Label>
        <Select
          value={cfg.tipo_numeracao}
          onValueChange={(v) => void persistirTipo(v as OperacaoCfg["tipo_numeracao"])}
        >
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="continua">Sequencial contínua</SelectItem>
            <SelectItem value="diaria">Reiniciar diariamente</SelectItem>
            <SelectItem value="mensal">Reiniciar mensalmente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={salvarConfig} disabled={busy || poolBusy} className="w-full">
        {poolBusy && <Loader2 className="size-4 animate-spin mr-2" />}
        Salvar Configuração
      </Button>
    </Card>
  );
}
