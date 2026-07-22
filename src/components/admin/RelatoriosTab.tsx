import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { FileDown, Printer, BarChart3 } from "lucide-react";
import { downloadCSV, printHTMLReport } from "@/lib/export";

type Pag = { id: string; forma: string; valor: number; created_at: string; comanda_id: string };
type Comanda = {
  id: string;
  total: number;
  status: string;
  aberta_em: string;
  fechada_em: string | null;
  mesa_id: string;
  garcom_id: string;
  desconto: number;
  acrescimo: number;
};
type Item = {
  id: string;
  pedido_id: string;
  produto_nome: string;
  quantidade: number;
  subtotal: number;
};
type Pedido = { id: string; comanda_id: string; setor: string; status: string; created_at: string };
type Produto = { id: string; nome: string; categoria_id: string | null };
type Categoria = { id: string; nome: string };
type Profile = { id: string; nome: string };
type Mov = { tipo: string; valor: number; created_at: string };

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
};

export function RelatoriosTab() {
  const [inicio, setInicio] = useState(weekAgo());
  const [fim, setFim] = useState(today());
  const [aba, setAba] = useState<
    "vendas" | "produtos" | "categorias" | "garcons" | "caixa" | "comandas" | "adicionais"
  >("vendas");

  const [pags, setPags] = useState<Pag[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [adicionaisRows, setAdicionaisRows] = useState<
    { adicional_nome: string; grupo_nome: string | null; preco: number; quantidade: number }[]
  >([]);

  const load = async () => {
    const start = new Date(inicio + "T00:00:00").toISOString();
    const end = new Date(fim + "T23:59:59").toISOString();
    const [
      { data: p },
      { data: c },
      { data: ps },
      { data: prd },
      { data: cat },
      { data: pf },
      { data: mv },
    ] = await Promise.all([
      supabase.from("pagamentos").select("*").gte("created_at", start).lte("created_at", end),
      supabase.from("comandas").select("*").gte("aberta_em", start).lte("aberta_em", end),
      supabase
        .from("pedidos")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .neq("status", "cancelado"),
      supabase.from("produtos").select("id,nome,categoria_id"),
      supabase.from("categorias").select("id,nome"),
      supabase.from("profiles").select("id,nome"),
      supabase
        .from("movimentacoes_caixa")
        .select("tipo,valor,created_at")
        .gte("created_at", start)
        .lte("created_at", end),
    ]);
    setPags((p ?? []) as Pag[]);
    setComandas((c ?? []) as Comanda[]);
    setPedidos((ps ?? []) as Pedido[]);
    setProdutos((prd ?? []) as Produto[]);
    setCategorias((cat ?? []) as Categoria[]);
    setProfiles((pf ?? []) as Profile[]);
    setMovs((mv ?? []) as Mov[]);
    const pids = (ps ?? []).map((x: Pedido) => x.id);
    if (pids.length) {
      const { data: its } = await supabase.from("itens_pedido").select("*").in("pedido_id", pids);
      const itensList = (its ?? []) as Item[];
      setItens(itensList);
      const itemIds = itensList.map((i) => i.id);
      if (itemIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: adics } = await (supabase as any)
          .from("itens_pedido_adicionais")
          .select("adicional_nome,grupo_nome,preco,quantidade")
          .in("item_pedido_id", itemIds);
        setAdicionaisRows(
          (adics ?? []) as {
            adicional_nome: string;
            grupo_nome: string | null;
            preco: number;
            quantidade: number;
          }[],
        );
      } else setAdicionaisRows([]);
    } else {
      setItens([]);
      setAdicionaisRows([]);
    }
  };
  useEffect(() => {
    load();
  }, [inicio, fim]);

  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    pags.forEach((p) => {
      const d = new Date(p.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(p.valor));
    });
    return [...map.entries()].sort();
  }, [pags]);

  const totalVendas = pags.reduce((s, p) => s + Number(p.valor), 0);
  const porForma = pags.reduce<Record<string, number>>((a, p) => {
    a[p.forma] = (a[p.forma] ?? 0) + Number(p.valor);
    return a;
  }, {});

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; total: number }>();
    itens.forEach((i) => {
      const cur = map.get(i.produto_nome) ?? { nome: i.produto_nome, qtd: 0, total: 0 };
      cur.qtd += i.quantidade;
      cur.total += Number(i.subtotal);
      map.set(i.produto_nome, cur);
    });
    return [...map.values()].sort((a, b) => b.qtd - a.qtd);
  }, [itens]);

  const porCategoria = useMemo(() => {
    const prodMap = new Map(produtos.map((p) => [p.nome, p.categoria_id]));
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
    const map = new Map<string, number>();
    itens.forEach((i) => {
      const cid = prodMap.get(i.produto_nome);
      const cnome = cid ? (catMap.get(cid) ?? "Sem categoria") : "Sem categoria";
      map.set(cnome, (map.get(cnome) ?? 0) + Number(i.subtotal));
    });
    return [...map.entries()]
      .map(([cat, total]) => ({ categoria: cat, total }))
      .sort((a, b) => b.total - a.total);
  }, [itens, produtos, categorias]);

  const porGarcom = useMemo(() => {
    const profMap = new Map(profiles.map((p) => [p.id, p.nome]));
    const map = new Map<string, { nome: string; comandas: number; total: number }>();
    comandas.forEach((c) => {
      const nome = profMap.get(c.garcom_id) ?? "Desconhecido";
      const cur = map.get(c.garcom_id) ?? { nome, comandas: 0, total: 0 };
      cur.comandas += 1;
      cur.total += Number(c.total);
      map.set(c.garcom_id, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [comandas, profiles]);

  const fluxoCaixa = useMemo(() => {
    const entradas = movs
      .filter((m) => ["entrada", "reforco"].includes(m.tipo))
      .reduce((s, m) => s + Number(m.valor), 0);
    const saidas = movs
      .filter((m) => ["saida", "sangria"].includes(m.tipo))
      .reduce((s, m) => s + Number(m.valor), 0);
    return { entradas, saidas, saldo: totalVendas + entradas - saidas };
  }, [movs, totalVendas]);

  const comandasFechadas = useMemo(
    () => comandas.filter((c) => c.status === "fechada"),
    [comandas],
  );

  const topAdicionais = useMemo(() => {
    const map = new Map<string, { nome: string; grupo: string; qtd: number; total: number }>();
    adicionaisRows.forEach((a) => {
      const key = `${a.grupo_nome ?? "-"}::${a.adicional_nome}`;
      const cur = map.get(key) ?? {
        nome: a.adicional_nome,
        grupo: a.grupo_nome ?? "-",
        qtd: 0,
        total: 0,
      };
      const q = Number(a.quantidade) || 1;
      cur.qtd += q;
      cur.total += Number(a.preco) * q;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => b.qtd - a.qtd);
  }, [adicionaisRows]);

  const exportar = () => {
    if (aba === "vendas")
      downloadCSV(
        `vendas_${inicio}_${fim}.csv`,
        vendasPorDia.map(([data, total]) => ({ data, total })),
      );
    if (aba === "produtos") downloadCSV(`top_produtos_${inicio}_${fim}.csv`, topProdutos);
    if (aba === "categorias") downloadCSV(`vendas_categoria_${inicio}_${fim}.csv`, porCategoria);
    if (aba === "garcons") downloadCSV(`vendas_garcom_${inicio}_${fim}.csv`, porGarcom);
    if (aba === "comandas")
      downloadCSV(
        `comandas_${inicio}_${fim}.csv`,
        comandasFechadas.map((c) => ({
          id: c.id,
          abertura: c.aberta_em,
          fechamento: c.fechada_em,
          total: c.total,
          desconto: c.desconto,
          acrescimo: c.acrescimo,
          status: c.status,
        })),
      );
    if (aba === "adicionais") downloadCSV(`adicionais_${inicio}_${fim}.csv`, topAdicionais);
  };

  const imprimirPDF = () => {
    let html = "";
    if (aba === "vendas") {
      html = `<table><thead><tr><th>Data</th><th>Total</th></tr></thead><tbody>${vendasPorDia.map(([d, t]) => `<tr><td>${d}</td><td>${brl(t)}</td></tr>`).join("")}</tbody><tfoot><tr class="sum"><td>Total</td><td>${brl(totalVendas)}</td></tr></tfoot></table>`;
    }
    if (aba === "produtos") {
      html = `<table><thead><tr><th>Produto</th><th>Qtd</th><th>Total</th></tr></thead><tbody>${topProdutos.map((p) => `<tr><td>${p.nome}</td><td>${p.qtd}</td><td>${brl(p.total)}</td></tr>`).join("")}</tbody></table>`;
    }
    if (aba === "categorias") {
      html = `<table><thead><tr><th>Categoria</th><th>Total</th></tr></thead><tbody>${porCategoria.map((c) => `<tr><td>${c.categoria}</td><td>${brl(c.total)}</td></tr>`).join("")}</tbody></table>`;
    }
    if (aba === "garcons") {
      html = `<table><thead><tr><th>Garçom</th><th>Comandas</th><th>Total</th></tr></thead><tbody>${porGarcom.map((g) => `<tr><td>${g.nome}</td><td>${g.comandas}</td><td>${brl(g.total)}</td></tr>`).join("")}</tbody></table>`;
    }
    if (aba === "caixa") {
      html = `<table><tbody>
        <tr><td>Vendas</td><td>${brl(totalVendas)}</td></tr>
        <tr><td>Entradas / reforços</td><td>${brl(fluxoCaixa.entradas)}</td></tr>
        <tr><td>Saídas / sangrias</td><td>- ${brl(fluxoCaixa.saidas)}</td></tr>
        <tr class="sum"><td>Saldo</td><td>${brl(fluxoCaixa.saldo)}</td></tr></tbody></table>`;
    }
    if (aba === "comandas") {
      html = `<table><thead><tr><th>Abertura</th><th>Fechamento</th><th>Total</th><th>Status</th></tr></thead><tbody>${comandasFechadas.map((c) => `<tr><td>${new Date(c.aberta_em).toLocaleString("pt-BR")}</td><td>${c.fechada_em ? new Date(c.fechada_em).toLocaleString("pt-BR") : "-"}</td><td>${brl(c.total)}</td><td>${c.status}</td></tr>`).join("")}</tbody></table>`;
    }
    if (aba === "adicionais") {
      html = `<table><thead><tr><th>Adicional</th><th>Grupo</th><th>Qtd</th><th>Total</th></tr></thead><tbody>${topAdicionais.map((a) => `<tr><td>${a.nome}</td><td>${a.grupo}</td><td>${a.qtd}</td><td>${brl(a.total)}</td></tr>`).join("")}</tbody></table>`;
    }
    printHTMLReport(`Relatório ${aba} · ${inicio} a ${fim}`, html);
  };

  const ticketMedio = comandasFechadas.length ? totalVendas / comandasFechadas.length : 0;

  return (
    <div>
      <Card className="p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <Label>Início</Label>
          <Input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
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
        <div>
          <Label>Relatório</Label>
          <Select value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vendas">Vendas por período</SelectItem>
              <SelectItem value="produtos">Produtos mais vendidos</SelectItem>
              <SelectItem value="categorias">Vendas por categoria</SelectItem>
              <SelectItem value="garcons">Vendas por garçom</SelectItem>
              <SelectItem value="caixa">Fluxo de caixa</SelectItem>
              <SelectItem value="comandas">Comandas fechadas</SelectItem>
              <SelectItem value="adicionais">Adicionais mais vendidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportar}>
            <FileDown className="size-3 mr-1" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={imprimirPDF}>
            <Printer className="size-3 mr-1" />
            PDF
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Vendas no período</p>
          <p className="font-display text-2xl text-success">{brl(totalVendas)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Comandas fechadas</p>
          <p className="font-display text-2xl">{comandasFechadas.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Ticket médio</p>
          <p className="font-display text-2xl">{brl(ticketMedio)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="font-display text-lg capitalize">{aba}</h3>
        </div>
        {aba === "vendas" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Data</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {vendasPorDia.map(([d, t]) => (
                <tr key={d} className="border-b border-border/50">
                  <td className="py-1.5">{d}</td>
                  <td className="text-right font-medium">{brl(t)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 font-bold">Total</td>
                <td className="text-right font-bold text-primary">{brl(totalVendas)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {aba === "produtos" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Produto</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topProdutos.map((p) => (
                <tr key={p.nome} className="border-b border-border/50">
                  <td className="py-1.5">{p.nome}</td>
                  <td className="text-right">{p.qtd}</td>
                  <td className="text-right font-medium">{brl(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {aba === "categorias" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Categoria</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porCategoria.map((c) => (
                <tr key={c.categoria} className="border-b border-border/50">
                  <td className="py-1.5">{c.categoria}</td>
                  <td className="text-right font-medium">{brl(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {aba === "garcons" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Garçom</th>
                <th className="text-right">Comandas</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {porGarcom.map((g) => (
                <tr key={g.nome} className="border-b border-border/50">
                  <td className="py-1.5">{g.nome}</td>
                  <td className="text-right">{g.comandas}</td>
                  <td className="text-right font-medium">{brl(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {aba === "caixa" && (
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              Vendas: <span className="font-semibold">{brl(totalVendas)}</span>
            </div>
            <div>
              Entradas:{" "}
              <span className="font-semibold text-success">{brl(fluxoCaixa.entradas)}</span>
            </div>
            <div>
              Saídas:{" "}
              <span className="font-semibold text-destructive">- {brl(fluxoCaixa.saidas)}</span>
            </div>
            <div>
              Saldo: <span className="font-semibold text-primary">{brl(fluxoCaixa.saldo)}</span>
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Por forma de pagamento</p>
              {Object.entries(porForma).map(([f, v]) => (
                <div key={f} className="flex justify-between">
                  <span className="capitalize">{f}</span>
                  <span className="font-medium">{brl(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {aba === "comandas" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Abertura</th>
                <th>Fechamento</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {comandasFechadas.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-1.5">{new Date(c.aberta_em).toLocaleString("pt-BR")}</td>
                  <td>{c.fechada_em ? new Date(c.fechada_em).toLocaleString("pt-BR") : "-"}</td>
                  <td className="text-right font-medium">{brl(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {aba === "adicionais" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2">Adicional</th>
                <th>Grupo</th>
                <th className="text-right">Qtd</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topAdicionais.map((a, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5">{a.nome}</td>
                  <td className="text-muted-foreground">{a.grupo}</td>
                  <td className="text-right">{a.qtd}</td>
                  <td className="text-right font-medium">{brl(a.total)}</td>
                </tr>
              ))}
              {topAdicionais.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    Nenhum adicional vendido no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
