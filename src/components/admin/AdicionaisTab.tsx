import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Layers, Package } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog, confirmDelete, handleDeleteError } from "@/lib/confirm";

import { brl } from "@/lib/format";

// Cast client para evitar dependência de types regenerados
// (as tabelas são novas nesta migração)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type TipoSelecao = "unica" | "multipla" | "quantidade";
type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  tipo_selecao: TipoSelecao;
  min_selecao: number;
  max_selecao: number;
  max_ilimitado: boolean;
  obrigatorio: boolean;
  qtd_inclusa: number;
};
type Adicional = {
  id: string;
  grupo_id: string;
  nome: string;
  preco: number;
  ordem: number;
  ativo: boolean;
};
type Produto = { id: string; nome: string; tem_adicionais: boolean };
type Vinculo = {
  id: string;
  produto_id: string;
  grupo_id: string;
  obrigatorio: boolean;
  min_selecao: number;
  max_selecao: number;
  ordem: number;
};

function descreverModo(
  g:
    | {
        tipo_selecao: TipoSelecao;
        min_selecao: number;
        max_selecao: number;
        max_ilimitado: boolean;
        obrigatorio: boolean;
      }
    | undefined
    | null,
): string {
  if (!g) return "";
  if (g.tipo_selecao === "unica") return g.obrigatorio ? "Única obrigatória" : "Única opcional";
  if (g.tipo_selecao === "quantidade")
    return `Quantidade livre${g.max_ilimitado ? "" : ` • até ${g.max_selecao}`}${g.obrigatorio ? " • Obrigatório" : ""}`;
  if (g.max_ilimitado) return `Múltipla livre${g.obrigatorio ? " • mín 1" : ""}`;
  return `Múltipla até ${g.max_selecao}${g.min_selecao > 0 ? ` • mín ${g.min_selecao}` : ""}${g.obrigatorio ? " • Obrigatório" : ""}`;
}

export function AdicionaisTab() {
  return (
    <Tabs defaultValue="grupos" className="w-full">
      <TabsList>
        <TabsTrigger value="grupos">
          <Layers className="size-4 mr-1" />
          Grupos & Itens
        </TabsTrigger>
        <TabsTrigger value="produtos">
          <Package className="size-4 mr-1" />
          Vincular a Produtos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="grupos" className="mt-4">
        <GruposManager />
      </TabsContent>
      <TabsContent value="produtos" className="mt-4">
        <VinculoManager />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------------- Grupos + Itens -------------------------- */
function GruposManager() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [itens, setItens] = useState<Adicional[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  const [gOpen, setGOpen] = useState(false);
  const [gForm, setGForm] = useState<Partial<Grupo>>({ ativo: true, ordem: 0 });

  const [iOpen, setIOpen] = useState(false);
  const [iForm, setIForm] = useState<Partial<Adicional>>({ ativo: true, preco: 0, ordem: 0 });

  const load = async () => {
    const [{ data: g }, { data: i }] = await Promise.all([
      sb.from("grupos_adicionais").select("*").order("ordem").order("nome"),
      sb.from("adicionais").select("*").order("ordem").order("nome"),
    ]);
    setGrupos((g ?? []) as Grupo[]);
    setItens((i ?? []) as Adicional[]);
    if (!sel && g && g.length) setSel(g[0].id);
  };
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, []);

  const saveGrupo = async () => {
    if (!gForm.nome?.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const empresa_id = (await sb.rpc("minha_empresa_id")).data;
    const tipo = (gForm.tipo_selecao ?? "unica") as TipoSelecao;
    const min = Math.max(0, Number(gForm.min_selecao ?? 0));
    const ilimitado = gForm.max_ilimitado ?? tipo === "quantidade";
    let max = ilimitado ? 999 : Math.max(1, Number(gForm.max_selecao ?? 1));
    if (tipo === "unica") max = 1;
    const payload = {
      nome: gForm.nome.trim(),
      descricao: gForm.descricao ?? null,
      ordem: Number(gForm.ordem ?? 0),
      ativo: gForm.ativo ?? true,
      tipo_selecao: tipo,
      min_selecao: min,
      max_selecao: max,
      max_ilimitado: ilimitado,
      obrigatorio: gForm.obrigatorio ?? false,
      qtd_inclusa: Math.min(max, Math.max(0, Number(gForm.qtd_inclusa ?? 0))),
    };
    const { error } = gForm.id
      ? await sb.from("grupos_adicionais").update(payload).eq("id", gForm.id)
      : await sb.from("grupos_adicionais").insert({ ...payload, empresa_id });
    if (error) return toast.error(error.message);
    toast.success("Grupo salvo");
    setGOpen(false);
    setGForm({
      ativo: true,
      ordem: 0,
      tipo_selecao: "unica",
      min_selecao: 0,
      max_selecao: 1,
      max_ilimitado: false,
      obrigatorio: false,
      qtd_inclusa: 0,
    });
    load();
  };
  const delGrupo = async (id: string) => {
    if (!(await confirmDelete("este grupo e seus itens"))) return;
    const { error } = await sb.from("grupos_adicionais").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    if (sel === id) setSel(null);
    load();
  };

  const saveItem = async () => {
    if (!iForm.nome?.trim() || !sel) {
      toast.error("Nome obrigatório");
      return;
    }
    const payload = {
      grupo_id: sel,
      nome: iForm.nome.trim(),
      preco: Number(iForm.preco ?? 0),
      ordem: Number(iForm.ordem ?? 0),
      ativo: iForm.ativo ?? true,
      empresa_id: (await sb.rpc("minha_empresa_id")).data,
    };
    const { error } = iForm.id
      ? await sb
          .from("adicionais")
          .update({
            nome: payload.nome,
            preco: payload.preco,
            ordem: payload.ordem,
            ativo: payload.ativo,
          })
          .eq("id", iForm.id)
      : await sb.from("adicionais").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Item salvo");
    setIOpen(false);
    setIForm({ ativo: true, preco: 0, ordem: 0 });
    load();
  };
  const delItem = async (id: string) => {
    if (!(await confirmDelete())) return;
    const { error } = await sb.from("adicionais").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    load();
  };

  const toggleItemAtivo = async (it: Adicional, ativo: boolean) => {
    setItens((arr) => arr.map((x) => (x.id === it.id ? { ...x, ativo } : x)));
    const { error } = await sb.from("adicionais").update({ ativo }).eq("id", it.id);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(ativo ? "Item disponível novamente." : "Item marcado como indisponível.");
  };

  const bulkSetAtivo = async (ativo: boolean) => {
    if (!sel) return;
    const ids = itens.filter((x) => x.grupo_id === sel).map((x) => x.id);
    if (ids.length === 0) return;
    setItens((arr) => arr.map((x) => (ids.includes(x.id) ? { ...x, ativo } : x)));
    const { error } = await sb.from("adicionais").update({ ativo }).in("id", ids);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(ativo ? "Todos disponibilizados" : "Todos ocultados");
  };

  const [filtro, setFiltro] = useState<"todos" | "ativos" | "ocultos">("todos");

  const itensDoGrupo = useMemo(() => {
    const base = itens.filter((x) => x.grupo_id === sel);
    if (filtro === "ativos") return base.filter((x) => x.ativo);
    if (filtro === "ocultos") return base.filter((x) => !x.ativo);
    return base;
  }, [itens, sel, filtro]);
  const itensTotais = useMemo(() => itens.filter((x) => x.grupo_id === sel), [itens, sel]);
  const totAtivos = itensTotais.filter((x) => x.ativo).length;
  const totOcultos = itensTotais.length - totAtivos;

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      {/* Grupos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Grupos</h3>
          <Dialog open={gOpen} onOpenChange={setGOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setGForm({
                    ativo: true,
                    ordem: 0,
                    tipo_selecao: "unica",
                    min_selecao: 0,
                    max_selecao: 1,
                    max_ilimitado: false,
                    obrigatorio: false,
                    qtd_inclusa: 0,
                  })
                }
              >
                <Plus className="size-3.5 mr-1" />
                Novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{gForm.id ? "Editar" : "Novo"} grupo</DialogTitle>
                <DialogDescription>Ex: Carnes, Molhos, Complementos, Borda</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={gForm.nome ?? ""}
                    onChange={(e) => setGForm({ ...gForm, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={gForm.descricao ?? ""}
                    onChange={(e) => setGForm({ ...gForm, descricao: e.target.value })}
                  />
                </div>
                {(() => {
                  const tipo = (gForm.tipo_selecao ?? "unica") as TipoSelecao;
                  const obrig = gForm.obrigatorio ?? false;
                  const ilim = gForm.max_ilimitado ?? false;
                  const modo:
                    | "unica_obrigatoria"
                    | "unica_opcional"
                    | "multipla_limitada"
                    | "multipla_livre" =
                    tipo === "unica"
                      ? obrig
                        ? "unica_obrigatoria"
                        : "unica_opcional"
                      : ilim
                        ? "multipla_livre"
                        : "multipla_limitada";
                  const setModo = (m: typeof modo) => {
                    if (m === "unica_obrigatoria")
                      setGForm((f) => ({
                        ...f,
                        tipo_selecao: "unica",
                        obrigatorio: true,
                        min_selecao: 1,
                        max_selecao: 1,
                        max_ilimitado: false,
                      }));
                    else if (m === "unica_opcional")
                      setGForm((f) => ({
                        ...f,
                        tipo_selecao: "unica",
                        obrigatorio: false,
                        min_selecao: 0,
                        max_selecao: 1,
                        max_ilimitado: false,
                      }));
                    else if (m === "multipla_limitada")
                      setGForm((f) => ({
                        ...f,
                        tipo_selecao: "multipla",
                        max_ilimitado: false,
                        min_selecao: f.min_selecao ?? 0,
                        max_selecao: Math.max(1, Number(f.max_selecao ?? 2)),
                      }));
                    else
                      setGForm((f) => ({
                        ...f,
                        tipo_selecao: "multipla",
                        max_ilimitado: true,
                        min_selecao: 0,
                      }));
                  };
                  return (
                    <>
                      <div>
                        <Label>Tipo de seleção</Label>
                        <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unica_obrigatoria">
                              Única obrigatória — escolha 1 (radio)
                            </SelectItem>
                            <SelectItem value="unica_opcional">
                              Única opcional — 0 ou 1 (radio)
                            </SelectItem>
                            <SelectItem value="multipla_limitada">
                              Múltipla limitada — checkbox com máximo
                            </SelectItem>
                            <SelectItem value="multipla_livre">
                              Múltipla livre — quantas desejar
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {modo === "multipla_limitada" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Mínimo</Label>
                            <Input
                              type="number"
                              min={0}
                              value={gForm.min_selecao ?? 0}
                              onChange={(e) =>
                                setGForm({ ...gForm, min_selecao: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label>Máximo</Label>
                            <Input
                              type="number"
                              min={1}
                              value={gForm.max_selecao ?? 2}
                              onChange={(e) =>
                                setGForm({ ...gForm, max_selecao: Number(e.target.value) })
                              }
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                            <Label className="text-xs">Obrigatório (mínimo ≥ 1)</Label>
                            <Switch
                              checked={gForm.obrigatorio ?? false}
                              onCheckedChange={(v) =>
                                setGForm({
                                  ...gForm,
                                  obrigatorio: v,
                                  min_selecao: v
                                    ? Math.max(1, Number(gForm.min_selecao ?? 1))
                                    : (gForm.min_selecao ?? 0),
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                      {modo === "multipla_livre" && (
                        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                          <Label className="text-xs">Obrigatório (pelo menos 1)</Label>
                          <Switch
                            checked={gForm.obrigatorio ?? false}
                            onCheckedChange={(v) =>
                              setGForm({ ...gForm, obrigatorio: v, min_selecao: v ? 1 : 0 })
                            }
                          />
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="rounded-md border border-border p-3 space-y-2">
                  <Label>Escolhas inclu?das no pre?o</Label>
                  <Input
                    type="number"
                    min={0}
                    max={gForm.max_ilimitado ? undefined : (gForm.max_selecao ?? 1)}
                    value={gForm.qtd_inclusa ?? 0}
                    onChange={(e) => setGForm({ ...gForm, qtd_inclusa: Number(e.target.value) })}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ex.: informe 1 em Carnes. A primeira escolha ser? gr?tis e as pr?ximas cobrar?o
                    o acr?scimo de cada item.
                  </p>
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={gForm.ordem ?? 0}
                    onChange={(e) => setGForm({ ...gForm, ordem: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={gForm.ativo ?? true}
                    onCheckedChange={(v) => setGForm({ ...gForm, ativo: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveGrupo}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-1">
          {grupos.map((g) => (
            <button
              key={g.id}
              onClick={() => setSel(g.id)}
              className={`w-full text-left p-2 rounded-md border text-sm transition ${
                sel === g.id
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{g.nome}</span>
                {!g.ativo && (
                  <Badge variant="secondary" className="text-[9px]">
                    Inativo
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {itens.filter((i) => i.grupo_id === g.id).length} itens • {descreverModo(g)}
              </p>
            </button>
          ))}
          {grupos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum grupo cadastrado
            </p>
          )}
        </div>
      </div>

      {/* Itens do grupo */}
      <div>
        {!sel ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Selecione um grupo à esquerda para gerenciar seus itens.
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-medium">{grupos.find((g) => g.id === sel)?.nome}</h3>
                <p className="text-xs text-muted-foreground">Itens deste grupo</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => delGrupo(sel)}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Excluir grupo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const g = grupos.find((x) => x.id === sel)!;
                    setGForm(g);
                    setGOpen(true);
                  }}
                >
                  Editar grupo
                </Button>
                <Dialog open={iOpen} onOpenChange={setIOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setIForm({ ativo: true, preco: 0, ordem: 0 })}>
                      <Plus className="size-3.5 mr-1" />
                      Novo item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{iForm.id ? "Editar" : "Novo"} item</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={iForm.nome ?? ""}
                          onChange={(e) => setIForm({ ...iForm, nome: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Preço adicional (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={iForm.preco ?? 0}
                          onChange={(e) => setIForm({ ...iForm, preco: Number(e.target.value) })}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          S? ? cobrado depois de usar as escolhas inclu?das do grupo
                        </p>
                      </div>
                      <div>
                        <Label>Ordem</Label>
                        <Input
                          type="number"
                          value={iForm.ordem ?? 0}
                          onChange={(e) => setIForm({ ...iForm, ordem: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Ativo</Label>
                        <Switch
                          checked={iForm.ativo ?? true}
                          onCheckedChange={(v) => setIForm({ ...iForm, ativo: v })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={saveItem}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap border-y border-border/60 py-2">
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setFiltro("todos")}
                  className={`px-3 py-1.5 ${filtro === "todos" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  Todos ({itensTotais.length})
                </button>
                <button
                  onClick={() => setFiltro("ativos")}
                  className={`px-3 py-1.5 border-l border-border ${filtro === "ativos" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  Disponíveis ({totAtivos})
                </button>
                <button
                  onClick={() => setFiltro("ocultos")}
                  className={`px-3 py-1.5 border-l border-border ${filtro === "ocultos" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  Ocultos ({totOcultos})
                </button>
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkSetAtivo(true)}>
                  Disponibilizar todos
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkSetAtivo(false)}>
                  Ocultar todos
                </Button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {itensDoGrupo.map((it) => (
                <Card
                  key={it.id}
                  className={`p-3 flex items-center gap-2 transition ${
                    it.ativo ? "" : "opacity-50 bg-muted/40"
                  }`}
                >
                  <span
                    className={`size-2.5 rounded-full shrink-0 ${it.ativo ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                    title={it.ativo ? "Disponível" : "Indisponível"}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium truncate ${it.ativo ? "" : "text-muted-foreground"}`}
                    >
                      {it.nome}
                    </p>
                    <p className={`text-xs ${it.ativo ? "text-primary" : "text-muted-foreground"}`}>
                      {it.preco > 0 ? `+ ${brl(it.preco)}` : "Gratuito"}
                    </p>
                    <p
                      className={`text-[10px] font-medium mt-0.5 ${it.ativo ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      {it.ativo ? "Disponível" : "Indisponível"}
                    </p>
                  </div>
                  <div className="flex items-center mr-1">
                    <Switch checked={it.ativo} onCheckedChange={(v) => toggleItemAtivo(it, v)} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setIForm(it);
                      setIOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() => delItem(it.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Card>
              ))}
              {itensDoGrupo.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  Nenhum item{" "}
                  {filtro === "ativos"
                    ? "disponível"
                    : filtro === "ocultos"
                      ? "oculto"
                      : "cadastrado"}{" "}
                  neste grupo
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Vínculo Produto ↔ Grupos -------------------- */
function VinculoManager() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addGrupo, setAddGrupo] = useState<string>("");
  const [addObrig, setAddObrig] = useState(false);
  const [addMin, setAddMin] = useState(0);
  const [addMax, setAddMax] = useState(1);
  const [addOrdem, setAddOrdem] = useState(0);

  const load = async () => {
    const [{ data: p }, { data: g }, { data: v }] = await Promise.all([
      sb.from("produtos").select("id,nome,tem_adicionais").eq("tem_adicionais", true).order("nome"),
      sb.from("grupos_adicionais").select("*").eq("ativo", true).order("nome"),
      sb.from("produto_grupos_adicionais").select("*").order("ordem"),
    ]);
    setProdutos((p ?? []) as Produto[]);
    setGrupos((g ?? []) as Grupo[]);
    setVinculos((v ?? []) as Vinculo[]);
  };
  useEffect(() => {
    load();
  }, []);

  const produto = produtos.find((p) => p.id === sel);
  const vincsProd = vinculos.filter((v) => v.produto_id === sel);

  const addVinc = async () => {
    if (!sel || !addGrupo) {
      toast.error("Escolha um grupo");
      return;
    }
    if (addMax < addMin) {
      toast.error("Máximo deve ser ≥ mínimo");
      return;
    }
    const payload = {
      produto_id: sel,
      grupo_id: addGrupo,
      obrigatorio: addObrig,
      min_selecao: addMin,
      max_selecao: addMax,
      ordem: addOrdem,
      empresa_id: (await sb.rpc("minha_empresa_id")).data,
    };
    const { error } = await sb.from("produto_grupos_adicionais").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Grupo vinculado");
    setAddOpen(false);
    setAddGrupo("");
    setAddObrig(false);
    setAddMin(0);
    setAddMax(1);
    setAddOrdem(0);
    load();
  };

  const updateVinc = async (id: string, patch: Partial<Vinculo>) => {
    const { error } = await sb.from("produto_grupos_adicionais").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const delVinc = async (id: string) => {
    if (
      !(await confirmDialog({
        description: "Remover este vínculo do produto? Esta ação não poderá ser desfeita.",
      }))
    )
      return;
    const { error } = await sb.from("produto_grupos_adicionais").delete().eq("id", id);
    if (handleDeleteError(error)) return;
    toast.success("Registro excluído com sucesso.");
    load();
  };

  const produtosFiltrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  const gruposDisponiveis = grupos.filter((g) => !vincsProd.some((v) => v.grupo_id === g.id));

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      {/* Lista de produtos com adicionais habilitados */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">Produtos personalizáveis</h3>
        <Input
          placeholder="Buscar..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-9"
        />
        <div className="space-y-1 max-h-[520px] overflow-auto">
          {produtosFiltrados.map((p) => (
            <button
              key={p.id}
              onClick={() => setSel(p.id)}
              className={`w-full text-left p-2 rounded-md border text-sm transition ${
                sel === p.id
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              <p className="font-medium truncate">{p.nome}</p>
              <p className="text-[11px] text-muted-foreground">
                {vinculos.filter((v) => v.produto_id === p.id).length} grupos vinculados
              </p>
            </button>
          ))}
          {produtos.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum produto marcado como "Personalizável". Ative essa opção no cadastro do produto.
            </p>
          )}
        </div>
      </div>

      {/* Vínculos do produto selecionado */}
      <div>
        {!produto ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Selecione um produto à esquerda.
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-medium">{produto.nome}</h3>
                <p className="text-xs text-muted-foreground">Grupos de ingredientes oferecidos</p>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={gruposDisponiveis.length === 0}>
                    <Plus className="size-3.5 mr-1" />
                    Vincular grupo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Vincular grupo</DialogTitle>
                    <DialogDescription>
                      As regras (tipo, mín/máx, obrigatório) são definidas no próprio grupo.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Grupo</Label>
                      <Select value={addGrupo} onValueChange={setAddGrupo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {gruposDisponiveis.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ordem de exibição</Label>
                      <Input
                        type="number"
                        value={addOrdem}
                        onChange={(e) => setAddOrdem(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={addVinc}>Vincular</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {vincsProd.map((v) => {
                const g = grupos.find((x) => x.id === v.grupo_id);
                return (
                  <Card key={v.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium">{g?.nome ?? "Grupo removido"}</p>
                        <p className="text-[11px] text-muted-foreground">{descreverModo(g)}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        onClick={() => delVinc(v.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="w-28">
                        <Label className="text-xs">Ordem</Label>
                        <Input
                          type="number"
                          className="h-8"
                          value={v.ordem}
                          onChange={(e) => updateVinc(v.id, { ordem: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
              {vincsProd.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum grupo vinculado. Clique em "Vincular grupo" acima.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
