import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl } from "@/lib/format";
import { logHistorico } from "@/lib/historico";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

import { PersonalizacaoModal, type AdicionalEscolhido } from "@/components/PersonalizacaoModal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Categoria = { id: string; nome: string; setor: "cozinha" | "bar" | "sobremesas" };
type Produto = {
  id: string;
  nome: string;
  preco: number;
  imagem_url: string | null;
  categoria_id: string | null;
  descricao: string | null;
  exige_preparo: boolean;
  tem_adicionais?: boolean;
};
interface SubmitItem {
  produto: Produto;
  qtd: number;
  obs: string;
  adicionais?: AdicionalEscolhido[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mesaId: string | null;
  comandaId: string | null;
  /** Nome do cliente — usado quando não há mesa (modo comandas avulsas). */
  clienteNome?: string | null;
  onCreated?: () => void;
}

export function AddItemsModal({
  open,
  onOpenChange,
  mesaId,
  comandaId,
  clienteNome,
  onCreated,
}: Props) {
  const { user, nome } = useAuth();
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [catAtiva, setCatAtiva] = useState<string>("");
  const [personProduto, setPersonProduto] = useState<Produto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setBusca("");
    setPersonProduto(null);
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("categorias").select("*").eq("ativo", true).order("ordem"),
        supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
      ]);
      setCats((c ?? []) as Categoria[]);
      setProds((p ?? []) as Produto[]);
      if (c && c.length) setCatAtiva(c[0].id);
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => buscaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    let list = prods;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      return prods.filter(
        (p) => p.nome.toLowerCase().includes(q) || (p.descricao ?? "").toLowerCase().includes(q),
      );
    }
    if (catAtiva) list = list.filter((x) => x.categoria_id === catAtiva);
    return list;
  }, [prods, catAtiva, busca]);

  const precoLinha = (it: SubmitItem) =>
    Number(it.produto.preco) +
    (it.adicionais ?? []).reduce((s, a) => s + Number(a.preco) * (a.quantidade ?? 1), 0);

  const setorCat = (cid: string | null) => cats.find((c) => c.id === cid)?.setor ?? "cozinha";

  const submitItems = async (items: SubmitItem[]) => {
    if (!user || !items.length) return;
    setEnviando(true);
    try {
      let cid = comandaId;
      let opened = false;
      if (!cid) {
        const insertPayload: {
          mesa_id: string | null;
          garcom_id: string;
          codigo: string;
          cliente_nome?: string;
        } = {
          mesa_id: mesaId,
          garcom_id: user.id,
          codigo: "",
        };
        if (clienteNome) insertPayload.cliente_nome = clienteNome;
        const { data: nc, error } = await supabase
          .from("comandas")
          .insert(insertPayload)
          .select()
          .single();
        if (error) throw error;
        cid = nc.id;
        opened = true;
        if (mesaId) {
          await supabase.from("mesas").update({ status: "ocupada" }).eq("id", mesaId);
        }
      }

      const grupos: Record<string, { items: SubmitItem[]; producao: boolean }> = {};
      items.forEach((it) => {
        if (it.produto.exige_preparo) {
          const s = setorCat(it.produto.categoria_id);
          const key = `prod_${s}`;
          (grupos[key] ||= { items: [], producao: true }).items.push(it);
        } else {
          (grupos["balcao"] ||= { items: [], producao: false }).items.push(it);
        }
      });

      const detalhes: { nome: string; qtd: number; preco: number; obs: string | null }[] = [];
      let totalLog = 0;

      for (const [key, grupo] of Object.entries(grupos)) {
        const setor = grupo.producao
          ? (key.replace("prod_", "") as "cozinha" | "bar" | "sobremesas")
          : "cozinha";
        const { data: ped, error: pe } = await supabase
          .from("pedidos")
          .insert({
            comanda_id: cid!,
            setor,
            criado_por: user.id,
            status: grupo.producao ? "pendente" : "entregue",
          })
          .select()
          .single();
        if (pe) throw pe;
        for (const it of grupo.items) {
          const precoUnit = precoLinha(it);
          totalLog += precoUnit * it.qtd;
          const { data: novoItem, error: ie } = await supabase
            .from("itens_pedido")
            .insert({
              pedido_id: ped.id,
              produto_id: it.produto.id,
              produto_nome: it.produto.nome,
              preco_unit: precoUnit,
              quantidade: it.qtd,
              observacao: it.obs || null,
            })
            .select("id")
            .single();
          if (ie) throw ie;
          if (it.adicionais?.length) {
            const empresaId = (await sb.rpc("minha_empresa_id")).data;
            const adRows = it.adicionais.map((a) => ({
              empresa_id: empresaId,
              item_pedido_id: novoItem.id,
              adicional_id: a.adicional_id,
              grupo_id: a.grupo_id,
              grupo_nome: a.grupo_nome,
              adicional_nome: a.adicional_nome,
              preco: a.preco,
              quantidade: a.quantidade ?? 1,
            }));
            const { error: ae } = await sb.from("itens_pedido_adicionais").insert(adRows);
            if (ae) throw ae;
          }
        }
        grupo.items.forEach((it) =>
          detalhes.push({
            nome: it.produto.nome,
            qtd: it.qtd,
            preco: precoLinha(it),
            obs: it.obs || null,
          }),
        );
      }

      if (opened) {
        await logHistorico({
          comanda_id: cid!,
          usuario_id: user.id,
          usuario_nome: nome ?? user.email ?? null,
          acao: "comanda_aberta",
        });
      }
      await logHistorico({
        comanda_id: cid!,
        usuario_id: user.id,
        usuario_nome: nome ?? user.email ?? null,
        acao: "itens_adicionados",
        detalhes: { itens: detalhes },
        valor: totalLog,
      });

      toast.success("Produto adicionado à comanda");
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      console.error("[add-items] falha ao salvar pedido", e);
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const add = (p: Produto) => {
    if (enviando) return;
    if (p.tem_adicionais) {
      setPersonProduto(p);
      return;
    }
    submitItems([{ produto: p, qtd: 1, obs: "" }]);
  };

  const handlePersonConfirm = (data: {
    adicionais: AdicionalEscolhido[];
    observacao: string;
    quantidade?: number;
  }) => {
    if (!personProduto) return;
    const p = personProduto;
    setPersonProduto(null);
    submitItems([
      { produto: p, qtd: data.quantidade ?? 1, obs: data.observacao, adicionais: data.adicionais },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[96vw] h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Cabeçalho fixo */}
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="font-display text-lg">Adicionar itens</DialogTitle>
        </DialogHeader>

        {/* Busca + categorias fixas */}
        <div className="px-3 py-2 space-y-2 border-b border-border shrink-0 bg-background">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={buscaRef}
              className="pl-9 h-9"
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {!busca && cats.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatAtiva(c.id)}
                  className={`px-3 h-7 rounded-full text-xs font-medium transition border
                    ${catAtiva === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Só a lista rola */}
        <div className="flex-1 overflow-y-auto p-3">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 px-3 py-1 hover:bg-muted/50 transition"
              >
                <button
                  onClick={() => add(p)}
                  className="flex-1 min-w-0 text-left flex items-baseline justify-between gap-2"
                >
                  <span className="font-medium text-sm truncate leading-tight">{p.nome}</span>
                  <span className="text-xs text-primary font-semibold whitespace-nowrap">
                    {brl(p.preco)}
                  </span>
                </button>
                {p.tem_adicionais && (
                  <span className="text-[9px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5">
                    <Sparkles className="size-2.5" />
                    Personalizar
                  </span>
                )}
                {!p.exige_preparo && (
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    Pronto
                  </span>
                )}
                <button
                  onClick={() => add(p)}
                  disabled={enviando}
                  className="size-8 shrink-0 grid place-items-center rounded-md bg-success text-success-foreground hover:bg-success/90 transition disabled:opacity-50"
                  aria-label="Adicionar"
                >
                  {enviando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-center text-muted-foreground py-12 text-sm">
                Nenhum produto encontrado
              </li>
            )}
          </ul>
        </div>

        <PersonalizacaoModal
          open={!!personProduto}
          onOpenChange={(v) => {
            if (!v) setPersonProduto(null);
          }}
          produto={personProduto}
          onConfirm={handlePersonConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
