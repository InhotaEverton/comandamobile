import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  XCircle,
  Users,
  BarChart3,
  PieChart as PieIcon,
  Clock,
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
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: RelatoriosPage,
});

type Periodo = "hoje" | "ontem" | "semana" | "mes" | "custom";

type Comanda = {
  id: string;
  status: string;
  origem: string | null;
  tipo_entrega: string | null;
  forma_pagamento: string | null;
  total: number;
  fechada_em: string | null;
  aberta_em: string;
  cliente_nome: string | null;
};

type Pag = { comanda_id: string; forma: string; valor: number };
type Item = { produto_nome: string; quantidade: number; subtotal: number; pedido_id: string };
type Pedido = { id: string; comanda_id: string };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(p: Periodo, ini: string, fim: string): [string, string] {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (p === "hoje") return [startOf(now).toISOString(), endOf(now).toISOString()];
  if (p === "ontem") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return [startOf(y).toISOString(), endOf(y).toISOString()];
  }
  if (p === "semana") {
    const s = new Date(now);
    s.setDate(s.getDate() - s.getDay());
    return [startOf(s).toISOString(), endOf(now).toISOString()];
  }
  if (p === "mes") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return [s.toISOString(), endOf(now).toISOString()];
  }
  return [new Date(ini + "T00:00:00").toISOString(), new Date(fim + "T23:59:59").toISOString()];
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success, 142 76% 36%))",
  "hsl(var(--warning, 38 92% 50%))",
  "hsl(var(--destructive))",
  "hsl(217 91% 60%)",
  "hsl(280 60% 55%)",
  "hsl(160 60% 45%)",
];
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const normForma = (f: string | null | undefined): string => {
  const v = (f ?? "").toLowerCase().trim();
  if (!v) return "Outro";
  if (v.includes("pix")) return "PIX";
  if (v.includes("dinheiro") || v.includes("cash")) return "Dinheiro";
  if (v.includes("cred")) return "Crédito";
  if (v.includes("deb")) return "Débito";
  if (v.includes("vale") || v.includes("vr") || v.includes("va")) return "Vale";
  if (v.includes("misto")) return "Misto";
  return v.charAt(0).toUpperCase() + v.slice(1);
};

function RelatoriosPage() {
  const { empresa } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [ini, setIni] = useState(isoDay(new Date()));
  const [fim, setFim] = useState(isoDay(new Date()));
  const [loading, setLoading] = useState(true);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [pags, setPags] = useState<Pag[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cfg, setCfg] = useState<{
    delivery_retirada_ativo: boolean;
    exibir_cardapio_online: boolean;
  } | null>(null);

  useEffect(() => {
    if (!empresa?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [start, end] = rangeFor(periodo, ini, fim);
      const [{ data: cm }, { data: cf }] = await Promise.all([
        supabase
          .from("comandas")
          .select(
            "id,status,origem,tipo_entrega,forma_pagamento,total,fechada_em,aberta_em,cliente_nome",
          )
          .eq("empresa_id", empresa.id)
          .gte("aberta_em", start)
          .lte("aberta_em", end),
        supabase
          .from("configuracoes")
          .select("delivery_retirada_ativo,exibir_cardapio_online")
          .eq("empresa_id", empresa.id)
          .maybeSingle(),
      ]);
      if (!alive) return;
      const cmList = (cm ?? []) as Comanda[];
      setComandas(cmList);
      setCfg(
        (cf as { delivery_retirada_ativo: boolean; exibir_cardapio_online: boolean } | null) ?? {
          delivery_retirada_ativo: true,
          exibir_cardapio_online: true,
        },
      );

      const ids = cmList.map((c) => c.id);
      if (ids.length) {
        const [{ data: p }, { data: pd }] = await Promise.all([
          supabase.from("pagamentos").select("comanda_id,forma,valor").in("comanda_id", ids),
          supabase
            .from("pedidos")
            .select("id,comanda_id")
            .in("comanda_id", ids)
            .neq("status", "cancelado"),
        ]);
        setPags((p ?? []) as Pag[]);
        const peds = (pd ?? []) as Pedido[];
        setPedidos(peds);
        const pids = peds.map((x) => x.id);
        if (pids.length) {
          const { data: its } = await supabase
            .from("itens_pedido")
            .select("produto_nome,quantidade,subtotal,pedido_id")
            .in("pedido_id", pids);
          setItens((its ?? []) as Item[]);
        } else setItens([]);
      } else {
        setPags([]);
        setPedidos([]);
        setItens([]);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [empresa?.id, periodo, ini, fim]);

  const finalizadas = useMemo(() => comandas.filter((c) => c.status === "fechada"), [comandas]);
  const canceladas = useMemo(() => comandas.filter((c) => c.status === "cancelada"), [comandas]);

  const faturamento = finalizadas.reduce((s, c) => s + Number(c.total), 0);
  const ticketMedio = finalizadas.length ? faturamento / finalizadas.length : 0;
  const clientesAtendidos = useMemo(() => {
    const set = new Set<string>();
    finalizadas.forEach((c) => {
      if (c.cliente_nome) set.add(c.cliente_nome.trim().toLowerCase());
    });
    return set.size || finalizadas.length;
  }, [finalizadas]);

  const topProdutos = useMemo(() => {
    const pedMap = new Map(pedidos.map((p) => [p.id, p.comanda_id]));
    const finSet = new Set(finalizadas.map((c) => c.id));
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    itens.forEach((i) => {
      const cid = pedMap.get(i.pedido_id);
      if (!cid || !finSet.has(cid)) return;
      const cur = map.get(i.produto_nome) ?? { nome: i.produto_nome, qtd: 0, total: 0 };
      cur.qtd += Number(i.quantidade);
      cur.total += Number(i.subtotal);
      map.set(i.produto_nome, cur);
    });
    return [...map.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 15);
  }, [itens, pedidos, finalizadas]);

  const origem = useMemo(() => {
    const canais: Record<string, { qtd: number; total: number }> = {};
    const add = (k: string, total: number) => {
      canais[k] = canais[k] ?? { qtd: 0, total: 0 };
      canais[k].qtd += 1;
      canais[k].total += total;
    };
    finalizadas.forEach((c) => {
      const t = Number(c.total);
      if (c.origem === "online") {
        if (c.tipo_entrega === "delivery") add("Delivery", t);
        else if (c.tipo_entrega === "retirada") add("Retirada", t);
        else add("Pedidos Online", t);
      } else {
        add("Comandas Internas", t);
      }
    });
    const canaisPermitidos = new Set<string>(["Comandas Internas"]);
    if (cfg?.exibir_cardapio_online !== false) canaisPermitidos.add("Pedidos Online");
    if (cfg?.delivery_retirada_ativo !== false) {
      canaisPermitidos.add("Delivery");
      canaisPermitidos.add("Retirada");
    }
    const list = Object.entries(canais)
      .filter(([k]) => canaisPermitidos.has(k) || canais[k].qtd > 0)
      .map(([nome, v]) => ({ nome, ...v }));
    const totalQtd = list.reduce((s, x) => s + x.qtd, 0) || 1;
    return list.map((x) => ({ ...x, pct: (x.qtd / totalQtd) * 100 })).sort((a, b) => b.qtd - a.qtd);
  }, [finalizadas, cfg]);

  const formas = useMemo(() => {
    // Prefer pagamentos (mais preciso); fallback comandas.forma_pagamento
    const finSet = new Set(finalizadas.map((c) => c.id));
    const map = new Map<string, { qtd: number; valor: number }>();
    const pagsByComanda = new Map<string, Pag[]>();
    pags.forEach((p) => {
      if (!finSet.has(p.comanda_id)) return;
      const arr = pagsByComanda.get(p.comanda_id) ?? [];
      arr.push(p);
      pagsByComanda.set(p.comanda_id, arr);
    });
    finalizadas.forEach((c) => {
      const list = pagsByComanda.get(c.id);
      if (list && list.length) {
        list.forEach((p) => {
          const k = normForma(p.forma);
          const cur = map.get(k) ?? { qtd: 0, valor: 0 };
          cur.qtd += 1;
          cur.valor += Number(p.valor);
          map.set(k, cur);
        });
      } else if (c.forma_pagamento) {
        const k = normForma(c.forma_pagamento);
        const cur = map.get(k) ?? { qtd: 0, valor: 0 };
        cur.qtd += 1;
        cur.valor += Number(c.total);
        map.set(k, cur);
      }
    });
    const list = [...map.entries()].map(([nome, v]) => ({ nome, ...v }));
    const total = list.reduce((s, x) => s + x.valor, 0) || 1;
    return list
      .map((x) => ({ ...x, pct: (x.valor / total) * 100 }))
      .sort((a, b) => b.valor - a.valor);
  }, [pags, finalizadas]);

  const porHora = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, "0")}h`,
      total: 0,
    }));
    finalizadas.forEach((c) => {
      const d = new Date(c.fechada_em ?? c.aberta_em);
      arr[d.getHours()].total += Number(c.total);
    });
    return arr;
  }, [finalizadas]);

  const porDiaSemana = useMemo(() => {
    const arr = DIAS.map((d) => ({ dia: d, total: 0 }));
    finalizadas.forEach((c) => {
      const d = new Date(c.fechada_em ?? c.aberta_em);
      arr[d.getDay()].total += Number(c.total);
    });
    return arr;
  }, [finalizadas]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Análise gerencial de vendas, canais e pagamentos.
          </p>
        </div>
      </div>

      <Card className="p-3 flex flex-wrap gap-3 items-end">
        <div>
          <Label>Período</Label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="ontem">Ontem</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "custom" && (
          <>
            <div>
              <Label>Início</Label>
              <Input
                type="date"
                value={ini}
                onChange={(e) => setIni(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label>Fim</Label>
              <Input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="w-40"
              />
            </div>
          </>
        )}
        {loading && <span className="text-xs text-muted-foreground ml-auto">Carregando…</span>}
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI
          icon={<DollarSign className="size-5" />}
          label="Faturamento"
          value={brl(faturamento)}
          accent="text-success"
        />
        <KPI
          icon={<ShoppingBag className="size-5" />}
          label="Pedidos"
          value={String(finalizadas.length)}
        />
        <KPI
          icon={<TrendingUp className="size-5" />}
          label="Ticket Médio"
          value={brl(ticketMedio)}
        />
        <KPI
          icon={<XCircle className="size-5" />}
          label="Cancelamentos"
          value={String(canceladas.length)}
          accent="text-destructive"
        />
        <KPI
          icon={<Users className="size-5" />}
          label="Clientes Atendidos"
          value={String(clientesAtendidos)}
        />
      </div>

      {/* Produtos mais vendidos */}
      <Card className="p-4">
        <SectionTitle icon={<BarChart3 className="size-4" />} title="Produtos mais vendidos" />
        {topProdutos.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProdutos.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 8, right: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2">Produto</th>
                    <th className="text-right">Qtd</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topProdutos.map((p) => (
                    <tr key={p.nome} className="border-b border-border/40">
                      <td className="py-1.5">{p.nome}</td>
                      <td className="text-right">{p.qtd}</td>
                      <td className="text-right font-medium">{brl(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Origem dos Pedidos */}
      <Card className="p-4">
        <SectionTitle icon={<PieIcon className="size-4" />} title="Origem dos pedidos" />
        {origem.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={origem}
                    dataKey="qtd"
                    nameKey="nome"
                    outerRadius={90}
                    label={(e: { nome: string; pct: number }) => `${e.nome} ${e.pct.toFixed(0)}%`}
                  >
                    {origem.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm self-center">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2">Canal</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {origem.map((o) => (
                  <tr key={o.nome} className="border-b border-border/40">
                    <td className="py-1.5">{o.nome}</td>
                    <td className="text-right">{o.qtd}</td>
                    <td className="text-right font-medium">{brl(o.total)}</td>
                    <td className="text-right">{o.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Formas de Pagamento */}
      <Card className="p-4">
        <SectionTitle icon={<PieIcon className="size-4" />} title="Formas de pagamento" />
        {formas.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={formas}
                    dataKey="valor"
                    nameKey="nome"
                    outerRadius={90}
                    label={(e: { nome: string; pct: number }) => `${e.nome} ${e.pct.toFixed(0)}%`}
                  >
                    {formas.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-sm self-center">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2">Forma</th>
                  <th className="text-right">Qtd</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {formas.map((f) => (
                  <tr key={f.nome} className="border-b border-border/40">
                    <td className="py-1.5">{f.nome}</td>
                    <td className="text-right">{f.qtd}</td>
                    <td className="text-right font-medium">{brl(f.valor)}</td>
                    <td className="text-right">{f.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Vendas por hora */}
      <Card className="p-4">
        <SectionTitle icon={<Clock className="size-4" />} title="Vendas por hora" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porHora}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Vendas por dia da semana */}
      <Card className="p-4">
        <SectionTitle icon={<BarChart3 className="size-4" />} title="Vendas por dia da semana" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porDiaSemana}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={`font-display text-2xl mt-1 ${accent ?? ""}`}>{value}</p>
    </Card>
  );
}
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <h3 className="font-display text-lg">{title}</h3>
    </div>
  );
}
function Empty() {
  return (
    <p className="text-sm text-muted-foreground py-6 text-center">
      Sem dados no período selecionado.
    </p>
  );
}
