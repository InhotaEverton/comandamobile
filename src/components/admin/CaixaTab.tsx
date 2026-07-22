import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { brl } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Lock,
  Unlock,
  Plus,
  Minus,
  DollarSign,
  FileDown,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/export";

type Caixa = {
  id: string;
  operador_id: string;
  valor_inicial: number;
  valor_final_informado: number | null;
  valor_esperado: number | null;
  diferenca: number | null;
  status: string;
  aberto_em: string;
  fechado_em: string | null;
  observacao: string | null;
};
type Mov = {
  id: string;
  caixa_id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  created_at: string;
};
type Pag = { id: string; forma: string; valor: number; origem: string | null; created_at: string };
type ModulosCfg = {
  modulos: Record<string, boolean> | null;
  aceita_entrega: boolean | null;
  aceita_retirada: boolean | null;
};

const ORIGEM_LABEL: Record<string, string> = {
  comanda: "Comandas",
  pedido_online: "Pedidos Online",
  delivery: "Delivery",
  retirada: "Retirada",
};
const FORMA_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  convenio: "Vale",
};

export function CaixaTab() {
  const { user } = useAuth();
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [historico, setHistorico] = useState<Caixa[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [pags, setPags] = useState<Pag[]>([]);
  const [cfg, setCfg] = useState<ModulosCfg | null>(null);
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openMov, setOpenMov] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);
  const [valorInicial, setValorInicial] = useState("0");
  const [mov, setMov] = useState<{ tipo: string; valor: string; descricao: string }>({
    tipo: "entrada",
    valor: "",
    descricao: "",
  });
  const [valorContado, setValorContado] = useState("");

  const load = async () => {
    const { data: cfgData } = await supabase
      .from("configuracoes")
      .select("modulos,aceita_entrega,aceita_retirada")
      .maybeSingle();
    setCfg((cfgData as ModulosCfg | null) ?? null);

    const { data: aberto } = await supabase
      .from("caixas")
      .select("*")
      .eq("status", "aberto")
      .order("aberto_em", { ascending: false })
      .maybeSingle();
    setCaixa((aberto as Caixa | null) ?? null);
    const { data: hist } = await supabase
      .from("caixas")
      .select("*")
      .order("aberto_em", { ascending: false })
      .limit(10);
    setHistorico((hist ?? []) as Caixa[]);
    if (aberto) {
      const { data: m } = await supabase
        .from("movimentacoes_caixa")
        .select("*")
        .eq("caixa_id", aberto.id)
        .order("created_at", { ascending: false });
      setMovs((m ?? []) as Mov[]);
      const { data: p } = await supabase
        .from("pagamentos")
        .select("id,forma,valor,origem,created_at")
        .eq("caixa_id", aberto.id);
      setPags((p ?? []) as Pag[]);
    } else {
      setMovs([]);
      setPags([]);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useRealtime(
    ["caixas", "movimentacoes_caixa", "pagamentos", "configuracoes"],
    load,
    "admin-caixa",
  );

  const origensAtivas = ((): string[] => {
    const m = cfg?.modulos ?? {};
    const list: string[] = [];
    if (m.comandas !== false) list.push("comanda");
    if (m.pedido_online) {
      if (cfg?.aceita_entrega) list.push("delivery");
      if (cfg?.aceita_retirada) list.push("retirada");
      if (!cfg?.aceita_entrega && !cfg?.aceita_retirada) list.push("pedido_online");
    }
    return list;
  })();

  const abrir = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("caixas")
      .insert({ operador_id: user.id, valor_inicial: Number(valorInicial.replace(",", ".")) || 0 });
    if (error) toast.error(error.message);
    else {
      toast.success("Caixa aberto");
      setOpenAbrir(false);
      setValorInicial("0");
      load();
    }
  };

  const lancar = async () => {
    if (!caixa || !user) return;
    const v = Number(mov.valor.replace(",", "."));
    if (!v || v <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if ((mov.tipo === "sangria" || mov.tipo === "saida") && !mov.descricao.trim()) {
      toast.error("Descreva o motivo da sangria/saída");
      return;
    }
    const { error } = await supabase.from("movimentacoes_caixa").insert({
      caixa_id: caixa.id,
      tipo: mov.tipo,
      valor: v,
      descricao: mov.descricao || null,
      registrado_por: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Movimentação registrada");
      setOpenMov(false);
      setMov({ tipo: "entrada", valor: "", descricao: "" });
    }
  };

  const totalDinheiro = pags
    .filter((p) => p.forma === "dinheiro")
    .reduce((s, p) => s + Number(p.valor), 0);
  const totalGeral = pags.reduce((s, p) => s + Number(p.valor), 0);
  const totalEntradas = movs
    .filter((m) => m.tipo === "entrada" || m.tipo === "reforco")
    .reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidas = movs
    .filter((m) => m.tipo === "saida" || m.tipo === "sangria")
    .reduce((s, m) => s + Number(m.valor), 0);
  const esperado = caixa
    ? Number(caixa.valor_inicial) + totalDinheiro + totalEntradas - totalSaidas
    : 0;
  const porForma = pags.reduce<Record<string, number>>((a, p) => {
    a[p.forma] = (a[p.forma] ?? 0) + Number(p.valor);
    return a;
  }, {});
  const porOrigem = pags.reduce<Record<string, { qtd: number; valor: number }>>((a, p) => {
    const o = p.origem || "comanda";
    a[o] = a[o] ?? { qtd: 0, valor: 0 };
    a[o].qtd += 1;
    a[o].valor += Number(p.valor);
    return a;
  }, {});
  const origensParaExibir =
    origensAtivas.length > 0
      ? origensAtivas.filter((o) => (porOrigem[o]?.qtd ?? 0) > 0 || origensAtivas.length <= 4)
      : Object.keys(porOrigem);

  const fechar = async () => {
    if (!caixa) return;
    const v = Number(valorContado.replace(",", "."));
    const diff = v - esperado;
    const { error } = await supabase
      .from("caixas")
      .update({
        status: "fechado",
        fechado_em: new Date().toISOString(),
        valor_final_informado: v,
        valor_esperado: esperado,
        diferenca: diff,
      })
      .eq("id", caixa.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Caixa fechado. Diferença: ${brl(diff)}`);
      setOpenFechar(false);
      setValorContado("");
      load();
    }
  };

  const exportarMovs = () => {
    downloadCSV(
      `movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`,
      movs.map((m) => ({
        data: new Date(m.created_at).toLocaleString("pt-BR"),
        tipo: m.tipo,
        valor: m.valor,
        descricao: m.descricao ?? "",
      })),
    );
  };

  if (!caixa) {
    return (
      <div>
        <Card className="p-6 text-center max-w-md mx-auto">
          <Lock className="size-12 mx-auto mb-3 text-muted-foreground" />
          <h2 className="font-display text-2xl mb-2">Caixa fechado</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Abra o caixa para começar a operação.
          </p>
          <Button onClick={() => setOpenAbrir(true)}>
            <Unlock className="size-4 mr-2" />
            Abrir caixa
          </Button>
        </Card>
        {historico.length > 0 && (
          <div className="max-w-3xl mx-auto mt-8">
            <h3 className="font-display text-lg mb-2">Últimos caixas</h3>
            {historico.map((c) => (
              <Card key={c.id} className="p-3 mb-2 text-sm flex justify-between">
                <div>
                  <Badge
                    variant={c.status === "aberto" ? "default" : "outline"}
                    className="capitalize mr-2"
                  >
                    {c.status}
                  </Badge>
                  {new Date(c.aberto_em).toLocaleString("pt-BR")}
                </div>
                <div className="text-right">
                  <div>Esperado: {brl(Number(c.valor_esperado ?? 0))}</div>
                  {c.diferenca != null && (
                    <div className={Number(c.diferenca) < 0 ? "text-destructive" : "text-success"}>
                      Diferença: {brl(Number(c.diferenca))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
        <Dialog open={openAbrir} onOpenChange={setOpenAbrir}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abertura de caixa</DialogTitle>
            </DialogHeader>
            <div>
              <Label>Valor inicial (troco)</Label>
              <Input
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <DialogFooter>
              <Button onClick={abrir}>Abrir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div>
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Vendas totais</p>
          <p className="font-display text-2xl text-success">{brl(totalGeral)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Em dinheiro</p>
          <p className="font-display text-2xl">{brl(totalDinheiro)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Entradas extras</p>
          <p className="font-display text-2xl">{brl(totalEntradas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Saídas / sangria</p>
          <p className="font-display text-2xl text-destructive">{brl(totalSaidas)}</p>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Aberto em {new Date(caixa.aberto_em).toLocaleString("pt-BR")}
            </p>
            <p>
              Valor inicial:{" "}
              <span className="font-semibold">{brl(Number(caixa.valor_inicial))}</span>
            </p>
            <p>
              Valor esperado em caixa:{" "}
              <span className="font-semibold text-primary">{brl(esperado)}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMov({ tipo: "reforco", valor: "", descricao: "" });
                setOpenMov(true);
              }}
            >
              <ArrowUpCircle className="size-4 mr-1 text-success" />
              Reforço
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMov({ tipo: "sangria", valor: "", descricao: "" });
                setOpenMov(true);
              }}
            >
              <ArrowDownCircle className="size-4 mr-1 text-destructive" />
              Sangria
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMov({ tipo: "entrada", valor: "", descricao: "" });
                setOpenMov(true);
              }}
            >
              <Plus className="size-4 mr-1" />
              Movimentação
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setValorContado(String(esperado.toFixed(2)));
                setOpenFechar(true);
              }}
            >
              <Lock className="size-4 mr-1" />
              Fechar caixa
            </Button>
          </div>
        </div>
        {Object.keys(porForma).length > 0 && (
          <div className="flex gap-4 mt-3 flex-wrap text-sm">
            {Object.entries(porForma).map(([f, v]) => (
              <div key={f}>
                <span className="text-muted-foreground">{FORMA_LABEL[f] ?? f}:</span>{" "}
                <span className="font-semibold">{brl(v)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {origensParaExibir.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="font-display text-base mb-3">Recebimentos por origem</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {origensParaExibir.map((o) => {
              const d = porOrigem[o] ?? { qtd: 0, valor: 0 };
              return (
                <div key={o} className="rounded border p-3">
                  <p className="text-xs text-muted-foreground uppercase">{ORIGEM_LABEL[o] ?? o}</p>
                  <p className="font-display text-xl">{brl(d.valor)}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.qtd} venda{d.qtd === 1 ? "" : "s"}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">Movimentações ({movs.length})</h3>
        <Button size="sm" variant="ghost" onClick={exportarMovs}>
          <FileDown className="size-3 mr-1" />
          Exportar CSV
        </Button>
      </div>
      <div className="space-y-2">
        {movs.map((m) => (
          <Card key={m.id} className="p-3 flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              {["entrada", "reforco"].includes(m.tipo) ? (
                <Plus className="size-4 text-success" />
              ) : (
                <Minus className="size-4 text-destructive" />
              )}
              <span className="capitalize font-medium">{m.tipo}</span>
              {m.descricao && <span className="text-muted-foreground">— {m.descricao}</span>}
            </div>
            <span
              className={`font-semibold ${["entrada", "reforco"].includes(m.tipo) ? "text-success" : "text-destructive"}`}
            >
              {["entrada", "reforco"].includes(m.tipo) ? "+" : "-"}
              {brl(Number(m.valor))}
            </span>
          </Card>
        ))}
        {movs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">Nenhuma movimentação</p>
        )}
      </div>

      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={mov.tipo} onValueChange={(v) => setMov({ ...mov, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="reforco">Reforço</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="sangria">Sangria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input
                value={mov.valor}
                onChange={(e) => setMov({ ...mov, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={mov.descricao}
                onChange={(e) => setMov({ ...mov, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={lancar}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechamento de caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span>Valor inicial</span>
                <span>{brl(Number(caixa.valor_inicial))}</span>
              </div>
              <div className="flex justify-between">
                <span>Vendas em dinheiro</span>
                <span>{brl(totalDinheiro)}</span>
              </div>
              <div className="flex justify-between">
                <span>Entradas / reforços</span>
                <span>{brl(totalEntradas)}</span>
              </div>
              <div className="flex justify-between">
                <span>Saídas / sangrias</span>
                <span>- {brl(totalSaidas)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t">
                <span>Esperado</span>
                <span>{brl(esperado)}</span>
              </div>
            </div>
            {origensParaExibir.length > 0 && (
              <div className="border rounded p-3 text-sm space-y-1">
                <p className="font-semibold mb-1">Resumo por origem</p>
                {origensParaExibir.map((o) => {
                  const d = porOrigem[o] ?? { qtd: 0, valor: 0 };
                  return (
                    <div key={o} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {ORIGEM_LABEL[o] ?? o} ({d.qtd})
                      </span>
                      <span>{brl(d.valor)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div>
              <Label>Valor contado no caixa</Label>
              <Input
                value={valorContado}
                onChange={(e) => setValorContado(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <DollarSign className="size-3 inline" /> A diferença será registrada para conferência.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={fechar}>Fechar caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
