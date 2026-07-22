import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X, ChevronDown, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type AdicionalEscolhido = {
  adicional_id: string;
  grupo_id: string;
  grupo_nome: string;
  adicional_nome: string;
  preco: number;
  quantidade: number;
};

type TipoSelecao = "unica" | "multipla" | "quantidade";
type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  qtd_inclusa: number;
  min_selecao: number;
  max_selecao: number;
  max_ilimitado: boolean;
  tipo_selecao: TipoSelecao;
  ordem: number;
};
type Item = { id: string; grupo_id: string; nome: string; preco: number; ordem: number };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto: { id: string; nome: string; preco: number; descricao?: string | null } | null;
  obsInicial?: string;
  modoEdicao?: boolean;
  onConfirm: (payload: {
    adicionais: AdicionalEscolhido[];
    observacao: string;
    quantidade?: number;
  }) => void;
}

const LIMIT_UNLIMITED = 9999;

export function PersonalizacaoModal({
  open,
  onOpenChange,
  produto,
  obsInicial,
  modoEdicao,
  onConfirm,
}: Props) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  // Mapa: grupo_id -> { adicional_id -> quantidade }
  const [sel, setSel] = useState<Record<string, Record<string, number>>>({});
  const [obs, setObs] = useState("");
  const [qtd, setQtd] = useState(1);
  const [loading, setLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [obsOpen, setObsOpen] = useState(false);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || !produto) return;
    setSel({});
    setObs(obsInicial ?? "");
    setQtd(1);
    setLoading(true);
    (async () => {
      const { data: vinc } = await sb
        .from("produto_grupos_adicionais")
        .select(
          "grupo_id, ordem, grupos_adicionais:grupo_id(id,nome,descricao,ativo,tipo_selecao,min_selecao,max_selecao,max_ilimitado,obrigatorio,qtd_inclusa)",
        )
        .eq("produto_id", produto.id)
        .order("ordem");

      type Row = {
        grupo_id: string;
        ordem: number;
        grupos_adicionais: {
          id: string;
          nome: string;
          descricao: string | null;
          ativo: boolean;
          tipo_selecao: TipoSelecao;
          min_selecao: number;
          max_selecao: number;
          max_ilimitado: boolean;
          obrigatorio: boolean;
          qtd_inclusa: number;
        } | null;
      };
      const gs: Grupo[] = ((vinc ?? []) as Row[])
        .filter((r) => r.grupos_adicionais?.ativo)
        .map((r) => {
          const g = r.grupos_adicionais!;
          const tipo = (g.tipo_selecao ?? "unica") as TipoSelecao;
          const ilimitado = tipo === "unica" ? false : (g.max_ilimitado ?? false);
          const max =
            tipo === "unica" ? 1 : ilimitado ? LIMIT_UNLIMITED : Math.max(1, g.max_selecao ?? 1);
          const min = Math.max(0, g.min_selecao ?? 0);
          return {
            id: r.grupo_id,
            nome: g.nome,
            descricao: g.descricao,
            obrigatorio: g.obrigatorio ?? false,
            qtd_inclusa: Math.max(0, g.qtd_inclusa ?? 0),
            min_selecao: min,
            max_selecao: max,
            max_ilimitado: ilimitado,
            tipo_selecao: tipo,
            ordem: r.ordem,
          };
        });
      setGrupos(gs);
      const firstOpen = gs.find((g) => g.obrigatorio)?.id ?? gs[0]?.id;
      setOpenGroups(firstOpen ? { [firstOpen]: true } : {});
      setObsOpen(Boolean(obsInicial) || gs.length === 0);

      if (gs.length) {
        const { data: its } = await sb
          .from("adicionais")
          .select("id,grupo_id,nome,preco,ordem")
          .in(
            "grupo_id",
            gs.map((g) => g.id),
          )
          .eq("ativo", true)
          .order("ordem")
          .order("nome");
        setItens((its ?? []) as Item[]);
      } else {
        setItens([]);
      }
      setLoading(false);
    })();
  }, [open, produto?.id, obsInicial]);

  useEffect(() => {
    const el = obsRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [obs, obsOpen]);

  const totalDoGrupo = (gid: string) => Object.values(sel[gid] ?? {}).reduce((a, b) => a + b, 0);

  const setQtdItem = (grupo: Grupo, itemId: string, qtdItem: number) => {
    setSel((prev) => {
      const cur = { ...(prev[grupo.id] ?? {}) };
      if (qtdItem <= 0) delete cur[itemId];
      else cur[itemId] = qtdItem;
      return { ...prev, [grupo.id]: cur };
    });
  };

  const inc = (grupo: Grupo, itemId: string) => {
    const cur = sel[grupo.id] ?? {};
    const total = totalDoGrupo(grupo.id);
    if (total >= grupo.max_selecao) return;
    setQtdItem(grupo, itemId, (cur[itemId] ?? 0) + 1);
  };
  const dec = (grupo: Grupo, itemId: string) => {
    const cur = sel[grupo.id] ?? {};
    setQtdItem(grupo, itemId, Math.max(0, (cur[itemId] ?? 0) - 1));
  };

  const incQtd = () => setQtd((n) => n + 1);
  const decQtd = () => setQtd((n) => Math.max(1, n - 1));

  const toggleUnica = (grupo: Grupo, itemId: string) => {
    setSel((prev) => ({
      ...prev,
      [grupo.id]: prev[grupo.id]?.[itemId] && !grupo.obrigatorio ? {} : { [itemId]: 1 },
    }));
  };
  const toggleMultipla = async (grupo: Grupo, itemId: string) => {
    const atuais = sel[grupo.id] ?? {};
    const totalAtual = Object.values(atuais).reduce((a, b) => a + b, 0);
    const item = itens.find((x) => x.id === itemId);
    if (!atuais[itemId] && totalAtual >= grupo.qtd_inclusa && Number(item?.preco ?? 0) > 0) {
      const confirmou = await confirmDialog({
        title: "Acréscimo na segunda escolha",
        description: `Ao adicionar ${item?.nome}, será acrescentado ${brl(Number(item?.preco ?? 0))} ao pedido.`,
        confirmText: "Adicionar com acréscimo",
        cancelText: "Cancelar",
        destructive: false,
      });
      if (!confirmou) return;
    }
    setSel((prev) => {
      const cur = { ...(prev[grupo.id] ?? {}) };
      if (cur[itemId]) delete cur[itemId];
      else {
        const total = Object.values(cur).reduce((a, b) => a + b, 0);
        if (total >= grupo.max_selecao) return prev;
        cur[itemId] = 1;
      }
      return { ...prev, [grupo.id]: cur };
    });
  };

  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  const extras = useMemo(() => {
    const out: AdicionalEscolhido[] = [];
    grupos.forEach((g) => {
      let gratuitas = Math.max(0, g.qtd_inclusa ?? 0);
      Object.entries(sel[g.id] ?? {}).forEach(([iid, q]) => {
        const it = itens.find((x) => x.id === iid);
        const qtdGratis = Math.min(gratuitas, q);
        const qtdCobrada = Math.max(0, q - qtdGratis);
        gratuitas -= qtdGratis;
        if (it && q > 0)
          out.push({
            adicional_id: it.id,
            grupo_id: g.id,
            grupo_nome: g.nome,
            adicional_nome: it.nome,
            preco: q > 0 ? (Number(it.preco) * qtdCobrada) / q : 0,
            quantidade: q,
          });
      });
    });
    return out;
  }, [sel, grupos, itens]);

  const somaExtras = extras.reduce((s, x) => s + x.preco * x.quantidade, 0);
  const total = ((produto?.preco ?? 0) + somaExtras) * qtd;

  const gruposConcluidos = grupos.filter((g) => {
    const n = totalDoGrupo(g.id);
    const min = Math.max(g.obrigatorio ? 1 : 0, g.min_selecao);
    return n >= min;
  }).length;
  const progresso = grupos.length ? Math.round((gruposConcluidos / grupos.length) * 100) : 100;

  const rotuloGrupo = (g: Grupo, totalGrupo: number) => {
    if (g.tipo_selecao === "unica") {
      return g.obrigatorio ? "Escolha 1 opção • Obrigatório" : "Escolha até 1 opção";
    }
    if (g.max_ilimitado) {
      return `Escolha quantas desejar • ${totalGrupo} selecionado${totalGrupo === 1 ? "" : "s"}${g.obrigatorio ? " • Obrigatório" : ""}`;
    }
    return `Escolha até ${g.max_selecao} • ${totalGrupo}/${g.max_selecao}${g.min_selecao > 0 ? ` • mín ${g.min_selecao}` : ""}${g.obrigatorio ? " • Obrigatório" : ""}`;
  };

  const validar = () => {
    for (const g of grupos) {
      const n = totalDoGrupo(g.id);
      const min = Math.max(g.obrigatorio ? 1 : 0, g.min_selecao);
      if (n < min) {
        toast.error(`Grupo "${g.nome}": selecione no mínimo ${min}`);
        setOpenGroups((p) => ({ ...p, [g.id]: true }));
        setTimeout(() => {
          const el = document.querySelector(`[data-grupo-id="${g.id}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);
        return false;
      }
    }
    return true;
  };

  const confirmar = () => {
    if (!validar()) return;
    onConfirm({
      adicionais: extras,
      observacao: obs.trim(),
      quantidade: modoEdicao ? undefined : qtd,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg w-[calc(100vw-1rem)] sm:w-full h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border px-3 py-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              Personalizar: <span className="text-foreground">{produto?.nome}</span>
            </p>
            {produto?.descricao && (
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {produto.descricao}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Base: <span className="font-medium text-foreground">{brl(produto?.preco ?? 0)}</span>
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 grid place-items-center size-8 rounded-md hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {grupos.length > 0 && (
          <div className="shrink-0 px-3 pt-1.5 pb-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
              <span>
                Montagem: {gruposConcluidos} de {grupos.length} grupos
              </span>
              <span>{progresso}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto px-3 py-1.5 space-y-1.5">
          {loading && (
            <div className="grid place-items-center py-6">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}

          {!loading &&
            grupos.map((g) => {
              const its = itens.filter((x) => x.grupo_id === g.id);
              const cur = sel[g.id] ?? {};
              const totalGrupo = totalDoGrupo(g.id);
              const isOpen = !!openGroups[g.id];
              const minReq = Math.max(g.obrigatorio ? 1 : 0, g.min_selecao);
              const ok = totalGrupo >= minReq;
              const cheio = totalGrupo >= g.max_selecao;
              const badge = g.max_ilimitado ? `${totalGrupo}` : `${totalGrupo}/${g.max_selecao}`;
              return (
                <div
                  key={g.id}
                  data-grupo-id={g.id}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40"
                  >
                    <ChevronDown
                      className={`size-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight truncate">
                        {g.nome}
                        {g.obrigatorio && <span className="text-destructive ml-1">*</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {rotuloGrupo(g, totalGrupo)}
                        {g.qtd_inclusa > 0
                          ? ` • ${g.qtd_inclusa} incluída${g.qtd_inclusa === 1 ? "" : "s"} no preço`
                          : ""}
                        {cheio && !g.max_ilimitado ? " • limite atingido" : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full border ${
                        ok
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {badge}
                      {ok && <Check className="inline size-3 ml-1 -mt-0.5" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-1.5 space-y-1">
                      {its.map((it) => {
                        const qtdItem = cur[it.id] ?? 0;
                        const checked = qtdItem > 0;

                        if (g.tipo_selecao === "quantidade") {
                          const bloqInc = cheio;
                          return (
                            <div
                              key={it.id}
                              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                            >
                              <span className="flex-1 truncate text-sm">{it.nome}</span>
                              <span
                                className={`text-xs shrink-0 ${g.qtd_inclusa === 0 && it.preco > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}
                              >
                                {g.qtd_inclusa === 0 && it.preco > 0 ? `+${brl(it.preco)}` : ""}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-7"
                                  onClick={() => dec(g, it.id)}
                                  disabled={qtdItem <= 0}
                                >
                                  <Minus className="size-3.5" />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium tabular-nums">
                                  {qtdItem}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-7"
                                  onClick={() => inc(g, it.id)}
                                  disabled={bloqInc}
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        const bloq = cheio && !checked;
                        const onPick = () => {
                          if (bloq) return;
                          if (g.tipo_selecao === "unica") toggleUnica(g, it.id);
                          else toggleMultipla(g, it.id);
                        };
                        return (
                          <div
                            key={it.id}
                            role="button"
                            tabIndex={0}
                            onClick={onPick}
                            onKeyDown={(e) => {
                              if ((e.key === "Enter" || e.key === " ") && !bloq) {
                                e.preventDefault();
                                onPick();
                              }
                            }}
                            className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm cursor-pointer transition select-none
                            ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}
                            ${bloq ? "opacity-50 cursor-not-allowed" : "hover:border-primary/40"}`}
                          >
                            {g.tipo_selecao === "unica" ? (
                              <span
                                className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-primary" : "border-muted-foreground/40"}`}
                              >
                                {checked && <span className="size-2 rounded-full bg-primary" />}
                              </span>
                            ) : (
                              <Checkbox
                                checked={checked}
                                disabled={bloq}
                                tabIndex={-1}
                                className="pointer-events-none"
                              />
                            )}
                            <span className="flex-1 truncate">{it.nome}</span>
                            <span
                              className={`text-xs shrink-0 ${g.qtd_inclusa === 0 && it.preco > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}
                            >
                              {g.qtd_inclusa === 0 && it.preco > 0 ? `+${brl(it.preco)}` : ""}
                            </span>
                          </div>
                        );
                      })}
                      {its.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1 px-1">
                          Sem itens cadastrados
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {!loading && (
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setObsOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/40"
              >
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform ${obsOpen ? "" : "-rotate-90"}`}
                />
                <p className="text-sm font-medium leading-tight flex-1">Observação</p>
                {obs.trim() && (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[50%]">
                    {obs.trim()}
                  </span>
                )}
              </button>
              {obsOpen && (
                <div className="px-2 pb-1.5">
                  <Textarea
                    ref={obsRef}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex.: sem cebola, pouco molho..."
                    className="min-h-[60px] max-h-[160px] resize-none py-2 text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-3 py-2 bg-background">
          <div className="flex items-center justify-between gap-3 mb-2">
            {!modoEdicao && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={decQtd}
                  disabled={qtd <= 1}
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="size-3.5" />
                </Button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">{qtd}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={incQtd}
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            )}
            <div className={`${modoEdicao ? "flex-1 text-right" : "text-right"}`}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                Total
              </div>
              <div className="font-display text-xl text-primary leading-tight">{brl(total)}</div>
            </div>
          </div>
          <Button onClick={confirmar} disabled={loading} className="w-full h-10">
            Adicionar ao pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
