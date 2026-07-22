import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  ChefHat,
  CheckCircle2,
  Clock,
  Store,
  X,
  ChevronDown,
  Check,
  Utensils,
  Trash2,
  Pencil,
  Bike,
  MapPin,
  CreditCard,
  ArrowLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm";
import { estaAberto, DIA_LABEL } from "@/lib/horario";
import type { HorariosSemana } from "@/hooks/useConfig";
import { createClientId } from "@/lib/id";

type Categoria = { id: string; nome: string; ordem: number };
type Produto = {
  id: string;
  nome: string;
  preco: number;
  descricao: string | null;
  imagem_url: string | null;
  categoria_id: string | null;
  tem_adicionais: boolean;
};
type Adicional = { id: string; nome: string; preco: number; ordem: number; ativo?: boolean | null };
type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_selecao: "unica" | "multipla" | "quantidade";
  min_selecao: number;
  max_selecao: number;
  max_ilimitado: boolean;
  obrigatorio: boolean;
  qtd_inclusa: number;
  adicionais: Adicional[];
};
type ProdutoGrupo = {
  produto_id: string;
  grupo_id: string;
  min_selecao: number;
  max_selecao: number;
  obrigatorio: boolean;
  ordem: number;
};
type Empresa = {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string | null;
  whatsapp: string | null;
  telefone: string | null;
  horario_ativo: boolean;
  horarios: HorariosSemana;
};
type Bairro = { id: string; nome: string; valor_frete: number; pedido_minimo: number | null };
type ConfigDelivery = {
  delivery_retirada_ativo: boolean;
  aceita_retirada: boolean;
  aceita_entrega: boolean;
  cobrar_taxa_entrega: boolean;
  taxa_entrega: number;
  pedido_minimo: number;
  tempo_preparo_min: number;
  exibir_tempo_estimado?: boolean;
  tempo_entrega_min?: number | null;
  tempo_entrega_max?: number | null;
  tempo_retirada_min?: number | null;
  tempo_retirada_max?: number | null;
};
type Cardapio = {
  empresa: Empresa;
  categorias: Categoria[];
  produtos: Produto[];
  grupos: Grupo[];
  produto_grupos: ProdutoGrupo[];
  adicionais: Array<{
    id: string;
    nome: string;
    preco: number;
    grupo_id: string;
    ordem?: number;
    ativo?: boolean | null;
  }>;
  bairros: Bairro[];
  config_delivery: ConfigDelivery;
};
type TipoEntrega = "retirada" | "entrega";
type FormaPagamento = "pix" | "dinheiro" | "cartao_entrega";

type AdicionalSel = {
  adicional_id: string;
  grupo_id: string;
  grupo_nome: string;
  adicional_nome: string;
  preco: number;
  quantidade: number;
};
type CartItem = {
  key: string;
  produto_id: string;
  nome: string;
  preco_base: number;
  quantidade: number;
  adicionais: AdicionalSel[];
  observacao: string;
  imagem: string | null;
};

export const Route = createFileRoute("/cardapio/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Cardápio — ${params.slug}` },
      { name: "description", content: "Faça seu pedido online direto pelo celular." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: CardapioPublico,
});

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function InfoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{valor}</span>
    </div>
  );
}
const LIMIT_UNLIMITED = 9999;

function truncar(s: string, n = 60) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function iconeCategoria(nome: string | null | undefined): string {
  const s = (nome ?? "").toLowerCase();
  if (/(sandu[ií]|burger|hamb|lanch)/.test(s)) return "🍔";
  if (/(marmit|prato|refei|almo|jant)/.test(s)) return "🍛";
  if (/(por[çc]|batat|fritas|petisc)/.test(s)) return "🍟";
  if (/(bebid|suco|refri|[aá]gua|drink|cerve)/.test(s)) return "🥤";
  if (/(pizza|calzone)/.test(s)) return "🍕";
  if (/(sobre|doce|torta|bolo|sorvet|a[çc]a[íi]|pudim)/.test(s)) return "🍰";
  if (/(salg|coxinh|pastel|esfih)/.test(s)) return "🥟";
  if (/(sushi|japon|temaki|sashim)/.test(s)) return "🍣";
  if (/(massa|macarr|espagu|lasan)/.test(s)) return "🍝";
  if (/(caf[eé]|cappucc|expresso)/.test(s)) return "☕";
  return "🍽️";
}

function maskWhats(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function normalizarWhats(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") ? d : `55${d}`;
}

function horaAgora() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dataHoraAgora() {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_entrega: "Cartão na entrega",
};

type EnderecoEntrega = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro_id: string | null;
  bairro_nome: string;
  cidade: string;
  estado: string;
  observacao: string;
};

function montarMensagemWA(
  _empresa: string,
  cliente: string,
  whatsappCli: string,
  itens: CartItem[],
  subtotal: number,
  taxaEntrega: number,
  total: number,
  tipo: TipoEntrega,
  endereco: EnderecoEntrega | null,
  forma: FormaPagamento,
  troco: number | null,
) {
  const L: string[] = [];
  L.push("🛎️ *NOVO PEDIDO ONLINE*");
  L.push("");
  L.push(
    `${tipo === "entrega" ? "🛵" : "🛍"} *Tipo:* ${tipo === "entrega" ? "Entrega" : "Retirada"}`,
  );
  L.push("");
  L.push("👤 *Cliente:*");
  L.push(cliente);
  if (whatsappCli) L.push(`📱 ${whatsappCli}`);
  L.push("");
  L.push("📅 *Data/Hora:*");
  L.push(dataHoraAgora());
  L.push("");
  if (tipo === "entrega" && endereco) {
    L.push("📍 *Endereço:*");
    L.push([endereco.rua, endereco.numero].filter(Boolean).join(", "));
    if (endereco.complemento) L.push(endereco.complemento);
    L.push([endereco.bairro_nome, endereco.cidade, endereco.estado].filter(Boolean).join(" · "));
    if (endereco.cep) L.push(`CEP ${endereco.cep}`);
    if (endereco.observacao) L.push(`📝 ${endereco.observacao}`);
    L.push("");
  }
  L.push("━━━━━━━━━━━━━━━━━━");
  L.push("");
  L.push("🍽️ *PEDIDO*");
  L.push("");
  itens.forEach((it) => {
    L.push(`${it.quantidade}x ${it.nome}`);
    const porGrupo = new Map<string, AdicionalSel[]>();
    it.adicionais.forEach((a) => {
      const arr = porGrupo.get(a.grupo_nome) ?? [];
      arr.push(a);
      porGrupo.set(a.grupo_nome, arr);
    });
    porGrupo.forEach((arr, grupo) => {
      L.push(`_${grupo}_`);
      arr.forEach((a) =>
        L.push(`• ${a.quantidade > 1 ? `${a.quantidade}x ` : ""}${a.adicional_nome}`),
      );
    });
    if (it.observacao) {
      L.push("📝 *Observações:*");
      L.push(it.observacao);
    }
    L.push("");
  });
  L.push("━━━━━━━━━━━━━━━━━━");
  L.push("");
  L.push(`Subtotal: ${fmt(subtotal)}`);
  if (taxaEntrega > 0) L.push(`Taxa de entrega: ${fmt(taxaEntrega)}`);
  L.push(`💰 *TOTAL:* ${fmt(total)}`);
  L.push("");
  L.push(`💳 *Pagamento:* ${FORMA_LABEL[forma]}`);
  if (forma === "dinheiro" && troco && troco > total) L.push(`Troco para: ${fmt(troco)}`);
  L.push("");
  L.push("📲 Origem: Pedido Online");
  L.push("");
  L.push("Obrigado pela preferência!");
  return L.join("\n");
}

function CardapioPublico() {
  const { slug } = Route.useParams();
  const [data, setData] = useState<Cardapio | null | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [personProduto, setPersonProduto] = useState<Produto | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoEntrega>("retirada");
  const [iniciado, setIniciado] = useState(false);
  const [busca, setBusca] = useState("");

  const [cliente, setCliente] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [endereco, setEndereco] = useState<EnderecoEntrega>({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro_id: null,
    bairro_nome: "",
    cidade: "",
    estado: "",
    observacao: "",
  });
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [trocoStr, setTrocoStr] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{
    primeiroNome: string;
    tipo: TipoEntrega;
    tempoTxt: string | null;
    total: number;
  } | null>(null);

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: res, error } = await supabase.rpc("get_cardapio_publico", { _slug: slug });
      if (error) {
        setData(null);
        return;
      }
      const parsed = res as unknown as Cardapio | null;
      setData(parsed);
      const raw = parsed?.empresa?.logo_url ?? null;
      if (!raw) {
        setLogoSrc(null);
        return;
      }
      if (/^https?:\/\//i.test(raw)) {
        setLogoSrc(raw);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("logos")
        .createSignedUrl(raw, 60 * 60 * 24 * 7);
      setLogoSrc(signed?.signedUrl ?? null);
    })();
  }, [slug]);

  // Autofill a partir do localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`cardapio:${slug}:cliente`);
      if (!raw) return;
      const c = JSON.parse(raw) as Partial<{
        nome: string;
        whatsapp: string;
        rua: string;
        numero: string;
        bairro_nome: string;
        complemento: string;
      }>;
      if (c.nome) setCliente(c.nome);
      if (c.whatsapp) setWhatsapp(c.whatsapp);
      setEndereco((e) => ({
        ...e,
        rua: c.rua ?? e.rua,
        numero: c.numero ?? e.numero,
        bairro_nome: c.bairro_nome ?? e.bairro_nome,
        complemento: c.complemento ?? e.complemento,
      }));
    } catch {
      /* ignore */
    }
  }, [slug]);

  // Rolagem única na página, sem barra de scroll interna visível
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("cardapio-page");
    return () => document.documentElement.classList.remove("cardapio-page");
  }, []);

  const totalItens = cart.reduce((a, b) => a + b.quantidade, 0);
  const totalCart = useMemo(
    () =>
      cart.reduce(
        (acc, it) =>
          acc +
          (it.preco_base + it.adicionais.reduce((s, a) => s + a.preco * a.quantidade, 0)) *
            it.quantidade,
        0,
      ),
    [cart],
  );

  if (data === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="font-display text-2xl mb-2">Cardápio indisponível</h1>
          <p className="text-sm text-muted-foreground">Este link ainda não está ativo.</p>
        </div>
      </div>
    );
  }

  const cfgDel: ConfigDelivery = data.config_delivery ?? {
    delivery_retirada_ativo: false,
    aceita_retirada: true,
    aceita_entrega: false,
    cobrar_taxa_entrega: true,
    taxa_entrega: 0,
    pedido_minimo: 0,
    tempo_preparo_min: 30,
  };
  const bairros: Bairro[] = data.bairros ?? [];
  const bairroSel = bairros.find((b) => b.id === endereco.bairro_id) ?? null;
  const taxaEntrega =
    tipo === "entrega" && cfgDel.cobrar_taxa_entrega
      ? bairroSel
        ? Number(bairroSel.valor_frete)
        : Number(cfgDel.taxa_entrega) || 0
      : 0;
  const totalFinal = totalCart + taxaEntrega;
  const mostraTipoStep = cfgDel.aceita_retirada && cfgDel.aceita_entrega;

  const abertoInfo = data.empresa.horario_ativo
    ? estaAberto(data.empresa.horarios)
    : { aberto: true, dia: { abre: "", fecha: "", aberto: true }, nome: "seg" as const };
  const categorias = data.categorias;
  const produtosDaCategoria = catAtiva
    ? data.produtos
        .filter((p) => p.categoria_id === catAtiva)
        .sort((a, b) => Number(a.preco) - Number(b.preco) || a.nome.localeCompare(b.nome, "pt-BR"))
    : [];
  const buscaNorm = busca.trim().toLowerCase();
  const produtosFiltrados = buscaNorm
    ? produtosDaCategoria.filter(
        (p) =>
          p.nome.toLowerCase().includes(buscaNorm) ||
          (p.descricao ?? "").toLowerCase().includes(buscaNorm),
      )
    : produtosDaCategoria;
  const categoriaAtiva = categorias.find((c) => c.id === catAtiva) ?? null;
  const categoriasComContagem = categorias
    .map((c) => ({ ...c, _count: data.produtos.filter((p) => p.categoria_id === c.id).length }))
    .filter((c) => c._count > 0);

  const gruposDoProduto = (pid: string): Grupo[] => {
    const links = (data.produto_grupos ?? [])
      .filter((pg) => pg.produto_id === pid)
      .sort((a, b) => a.ordem - b.ordem);
    const adicionaisSeparados = Array.isArray(data.adicionais) ? data.adicionais : [];
    return links
      .map((l) => {
        const g = (data.grupos ?? []).find((x) => x.id === l.grupo_id);
        if (!g) return null;
        const adicionaisFonte = [
          ...(Array.isArray(g.adicionais) ? g.adicionais : []),
          ...adicionaisSeparados.filter((a) => a.grupo_id === g.id),
        ];
        const adicionaisMap = new Map<string, Adicional>();
        adicionaisFonte
          .filter((a) => a.ativo !== false)
          .forEach((a, i) =>
            adicionaisMap.set(a.id, {
              id: a.id,
              nome: a.nome,
              preco: Number(a.preco),
              ordem: a.ordem ?? i,
            }),
          );
        const adicionais = Array.from(adicionaisMap.values()).sort(
          (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
        );
        if (adicionais.length === 0) return null;
        const tipo = (g.tipo_selecao ?? "unica") as "unica" | "multipla" | "quantidade";
        const ilimitado = tipo === "unica" ? false : (g.max_ilimitado ?? false);
        const max =
          tipo === "unica"
            ? 1
            : ilimitado
              ? 9999
              : Math.max(1, l.max_selecao ?? g.max_selecao ?? 1);
        const min = Math.max(0, l.min_selecao ?? g.min_selecao ?? 0);
        const obrigatorio = l.obrigatorio ?? g.obrigatorio ?? false;
        return {
          ...g,
          adicionais,
          obrigatorio,
          min_selecao: min,
          max_selecao: max,
          max_ilimitado: ilimitado,
          tipo_selecao: tipo,
        };
      })
      .filter(Boolean) as Grupo[];
  };

  const handleAdd = (p: Produto) => {
    if (p.tem_adicionais && gruposDoProduto(p.id).length > 0) {
      setEditingItem(null);
      setPersonProduto(p);
      return;
    }
    setCart((c) => {
      const idx = c.findIndex(
        (x) => x.produto_id === p.id && x.adicionais.length === 0 && !x.observacao,
      );
      if (idx >= 0) {
        const next = c.slice();
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 };
        return next;
      }
      const key = `${p.id}::${createClientId()}`;
      return [
        ...c,
        {
          key,
          produto_id: p.id,
          nome: p.nome,
          preco_base: p.preco,
          quantidade: 1,
          adicionais: [],
          observacao: "",
          imagem: p.imagem_url,
        },
      ];
    });
  };

  const simpleQty = (pid: string) =>
    cart
      .filter((x) => x.produto_id === pid && x.adicionais.length === 0 && !x.observacao)
      .reduce((a, b) => a + b.quantidade, 0);

  const decSimple = (pid: string) =>
    setCart((c) => {
      const idx = c.findIndex(
        (x) => x.produto_id === pid && x.adicionais.length === 0 && !x.observacao,
      );
      if (idx < 0) return c;
      const it = c[idx];
      if (it.quantidade <= 1) return c.filter((_, i) => i !== idx);
      const next = c.slice();
      next[idx] = { ...it, quantidade: it.quantidade - 1 };
      return next;
    });

  const removeCartItem = (key: string) => setCart((c) => c.filter((x) => x.key !== key));
  const changeQtd = (key: string, delta: number) =>
    setCart((c) =>
      c.map((it) =>
        it.key === key ? { ...it, quantidade: Math.max(1, it.quantidade + delta) } : it,
      ),
    );

  const abrirCheckout = () => {
    // Tipo já escolhido na tela de boas-vindas; segue direto para o checkout.
    setCheckoutOpen(true);
  };

  const buscarClienteWA = async (raw: string) => {
    const wa = raw.replace(/\D/g, "");
    if (wa.length < 10) return;
    const { data: cli } = await supabase.rpc("buscar_cliente_online", {
      _slug: slug,
      _whatsapp: wa,
    });
    if (!cli) return;
    const c = cli as Record<string, string | null>;
    if (c.nome) setCliente((prev) => prev || (c.nome as string));
    setEndereco((e) => ({
      ...e,
      cep: e.cep || (c.cep ?? ""),
      rua: e.rua || (c.rua ?? ""),
      numero: e.numero || (c.numero ?? ""),
      complemento: e.complemento || (c.complemento ?? ""),
      bairro_nome: e.bairro_nome || (c.bairro ?? ""),
      cidade: e.cidade || (c.cidade ?? ""),
      estado: e.estado || (c.estado ?? ""),
    }));
    if (c.forma_pagamento && ["pix", "dinheiro", "cartao_entrega"].includes(c.forma_pagamento)) {
      setForma(c.forma_pagamento as FormaPagamento);
    }
    if (c.bairro && bairros.length) {
      const match = bairros.find((b) => b.nome.toLowerCase() === (c.bairro ?? "").toLowerCase());
      if (match) setEndereco((e) => ({ ...e, bairro_id: match.id, bairro_nome: match.nome }));
    }
    toast.success("Bem-vindo de volta! Confira seus dados.");
  };

  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setEndereco((e) => ({
          ...e,
          cep: digits.replace(/(\d{5})(\d{3})/, "$1-$2"),
          rua: j.logradouro || e.rua,
          bairro_nome: j.bairro || e.bairro_nome,
          cidade: j.localidade || e.cidade,
          estado: j.uf || e.estado,
        }));
        if (bairros.length && j.bairro) {
          const match = bairros.find(
            (b) => b.nome.toLowerCase() === String(j.bairro).toLowerCase(),
          );
          if (match) setEndereco((e) => ({ ...e, bairro_id: match.id, bairro_nome: match.nome }));
        }
      }
    } catch {
      /* ignore */
    }
    setCepLoading(false);
  };

  const enviar = async () => {
    if (!abertoInfo.aberto) {
      toast.error("Estamos fechados no momento.");
      return;
    }
    if (!cliente.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    const wsDigits = whatsapp.replace(/\D/g, "");
    if (wsDigits.length < 10) {
      toast.error("Informe um WhatsApp válido");
      return;
    }
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    if (cfgDel.pedido_minimo > 0 && totalCart < cfgDel.pedido_minimo) {
      toast.error(`Pedido mínimo de ${fmt(cfgDel.pedido_minimo)}`);
      return;
    }
    if (tipo === "entrega") {
      if (!endereco.numero.trim()) {
        toast.error("Informe o número");
        return;
      }
      if (!endereco.rua.trim() || !endereco.bairro_nome.trim()) {
        toast.error("Informe o endereço");
        return;
      }
      if (bairros.length && !endereco.bairro_id) {
        toast.error("Selecione seu bairro");
        return;
      }
    }
    const troco = forma === "dinheiro" ? Number(trocoStr.replace(/\D/g, "")) / 100 : null;
    if (forma === "dinheiro" && troco && troco > 0 && troco < totalFinal) {
      toast.error("Troco deve ser maior que o total");
      return;
    }
    setSending(true);
    const itens = cart.flatMap((it) =>
      Array.from({ length: it.quantidade }, () => ({
        produto_id: it.produto_id,
        quantidade: 1,
        observacao: it.observacao || null,
        adicionais: it.adicionais.map((a) => ({
          adicional_id: a.adicional_id,
          quantidade: a.quantidade,
        })),
      })),
    );
    const _entrega =
      tipo === "entrega"
        ? {
            cep: endereco.cep,
            rua: endereco.rua,
            numero: endereco.numero,
            complemento: endereco.complemento,
            bairro_id: endereco.bairro_id,
            bairro: endereco.bairro_nome,
            cidade: endereco.cidade,
            estado: endereco.estado,
            observacao: endereco.observacao,
          }
        : null;
    const _pagamento = { forma, troco_para: troco };
    const { error } = await supabase.rpc("criar_pedido_online", {
      _slug: slug,
      _cliente: cliente.trim(),
      _whatsapp: wsDigits,
      _tipo: tipo,
      _itens: itens,
      _entrega: _entrega as never,
      _pagamento: _pagamento as never,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `cardapio:${slug}:cliente`,
          JSON.stringify({
            nome: cliente.trim(),
            whatsapp,
            rua: endereco.rua,
            numero: endereco.numero,
            bairro_nome: endereco.bairro_nome,
            complemento: endereco.complemento,
          }),
        );
      }
    } catch {
      /* ignore */
    }

    const primeiroNome = cliente.trim().split(/\s+/)[0] || "cliente";
    const tMin = tipo === "entrega" ? cfgDel.tempo_entrega_min : cfgDel.tempo_retirada_min;
    const tMax = tipo === "entrega" ? cfgDel.tempo_entrega_max : cfgDel.tempo_retirada_max;
    const exibirTempo = cfgDel.exibir_tempo_estimado !== false;
    let tempoTxt: string | null = null;
    if (exibirTempo) {
      const min = tMin ? Number(tMin) : 0;
      const max = tMax ? Number(tMax) : 0;
      if (min > 0 && max > 0 && max !== min) tempoTxt = `${min}–${max} min`;
      else if (min > 0 || max > 0) tempoTxt = `aproximadamente ${min || max} min`;
    }

    setReviewOpen(false);
    setCheckoutOpen(false);
    setTipoOpen(false);
    setConfirmacao({ primeiroNome, tipo, tempoTxt, total: totalFinal });
    setSuccessOverlay(true);

    setTimeout(() => {
      setCart([]);
      setCliente("");
      setWhatsapp("");
      setEndereco({
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro_id: null,
        bairro_nome: "",
        cidade: "",
        estado: "",
        observacao: "",
      });
      setTrocoStr("");
      setForma("pix");
      setCatAtiva(null);
      setPersonProduto(null);
      setSuccessOverlay(false);
      setConfirmacao(null);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }, 4000);
  };

  // Tela de boas-vindas antes de entrar no cardápio
  if (!iniciado) {
    const tempoEntregaTxt = (() => {
      const min = Number(cfgDel.tempo_entrega_min || 0);
      const max = Number(cfgDel.tempo_entrega_max || 0);
      if (cfgDel.exibir_tempo_estimado !== false && (min || max)) {
        return min && max && min !== max ? `${min}–${max} min` : `~${min || max} min`;
      }
      return null;
    })();
    const tempoRetiradaTxt = (() => {
      const min = Number(cfgDel.tempo_retirada_min || 0);
      const max = Number(cfgDel.tempo_retirada_max || 0);
      if (cfgDel.exibir_tempo_estimado !== false && (min || max)) {
        return min && max && min !== max ? `${min}–${max} min` : `~${min || max} min`;
      }
      return null;
    })();
    const iniciar = (t: TipoEntrega) => {
      setTipo(t);
      setIniciado(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    };
    const soRetirada = cfgDel.aceita_retirada && !cfgDel.aceita_entrega;
    const soEntrega = cfgDel.aceita_entrega && !cfgDel.aceita_retirada;
    const ambos = cfgDel.aceita_retirada && cfgDel.aceita_entrega;
    return (
      <div className="min-h-dvh bg-gradient-to-b from-primary/5 via-background to-background flex flex-col">
        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center text-center gap-4 mb-8">
              <div className="size-24 rounded-3xl bg-primary grid place-items-center shadow-xl shadow-primary/30 overflow-hidden">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={`Logo ${data.empresa.nome}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <ChefHat className="size-12 text-primary-foreground" />
                )}
              </div>
              <div>
                <h1 className="font-display text-3xl leading-tight">{data.empresa.nome}</h1>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {abertoInfo.aberto ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                      <span className="size-2 rounded-full bg-success animate-pulse" />
                      Aberto agora
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-destructive">
                      <span className="size-2 rounded-full bg-destructive" />
                      Fechado
                      {data.empresa.horario_ativo && abertoInfo.dia.abre
                        ? ` · abre às ${abertoInfo.dia.abre}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full grid grid-cols-1 gap-2 mt-2">
                {cfgDel.aceita_entrega && (
                  <div className="flex items-center justify-between rounded-2xl bg-card border border-border px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Bike className="size-4 text-primary" />
                      <span className="font-medium">Entrega</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tempoEntregaTxt ?? "Disponível"}
                      {cfgDel.cobrar_taxa_entrega && Number(cfgDel.taxa_entrega) > 0 && (
                        <span className="ml-1">· {fmt(Number(cfgDel.taxa_entrega))}</span>
                      )}
                    </div>
                  </div>
                )}
                {cfgDel.aceita_retirada && (
                  <div className="flex items-center justify-between rounded-2xl bg-card border border-border px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Store className="size-4 text-primary" />
                      <span className="font-medium">Retirada no balcão</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {tempoRetiradaTxt ?? "Disponível"}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!abertoInfo.aberto ? (
              <Card className="p-4 bg-destructive/5 border-destructive/30 text-center text-destructive">
                <div className="font-semibold mb-1">Estamos fechados no momento</div>
                <div className="text-sm">Volte durante nosso horário de funcionamento.</div>
              </Card>
            ) : ambos ? (
              <div className="grid grid-cols-1 gap-3">
                <Button
                  className="h-14 rounded-2xl text-base font-semibold"
                  onClick={() => iniciar("entrega")}
                >
                  <Bike className="size-5 mr-2" /> Pedir para Entrega
                </Button>
                <Button
                  variant="outline"
                  className="h-14 rounded-2xl text-base font-semibold"
                  onClick={() => iniciar("retirada")}
                >
                  <Store className="size-5 mr-2" /> Retirar no Balcão
                </Button>
              </div>
            ) : soEntrega ? (
              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold"
                onClick={() => iniciar("entrega")}
              >
                <Bike className="size-5 mr-2" /> Fazer Pedido
              </Button>
            ) : soRetirada ? (
              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold"
                onClick={() => iniciar("retirada")}
              >
                <Utensils className="size-5 mr-2" /> Iniciar Pedido
              </Button>
            ) : (
              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold"
                onClick={() => iniciar("retirada")}
              >
                <Utensils className="size-5 mr-2" /> Iniciar Pedido
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      {successOverlay && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm grid place-items-center px-4 animate-fade-in"
          aria-live="polite"
          role="dialog"
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl animate-scale-in flex flex-col items-center gap-4 text-center">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-success/15 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-success/25" />
              <div className="relative w-full h-full grid place-items-center">
                <CheckCircle2 className="size-16 text-success" strokeWidth={2.2} />
              </div>
            </div>
            <div>
              <h2 className="font-display text-xl leading-tight">Pedido recebido com sucesso!</h2>
              {confirmacao && (
                <p className="text-sm text-muted-foreground mt-1">
                  Olá,{" "}
                  <span className="font-semibold text-foreground">{confirmacao.primeiroNome}</span>.
                  Seu pedido foi enviado para{" "}
                  <span className="font-semibold text-foreground">{data.empresa.nome}</span>.
                </p>
              )}
            </div>
            {confirmacao && (
              <div className="w-full grid grid-cols-1 gap-2 text-left">
                <InfoLinha
                  label="Tipo"
                  valor={confirmacao.tipo === "entrega" ? "🛵 Entrega" : "🏪 Retirada"}
                />
                {confirmacao.tempoTxt && (
                  <InfoLinha label="Tempo estimado" valor={confirmacao.tempoTxt} />
                )}
                <InfoLinha label="Total" valor={fmt(confirmacao.total)} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Você receberá atualizações do estabelecimento quando o pedido for confirmado e quando
              sair para entrega ou estiver pronto para retirada.
            </p>
            <Button
              className="w-full h-11 rounded-xl"
              onClick={() => {
                setSuccessOverlay(false);
                setConfirmacao(null);
                setCart([]);
                setCliente("");
                setWhatsapp("");
                setEndereco({
                  cep: "",
                  rua: "",
                  numero: "",
                  complemento: "",
                  bairro_id: null,
                  bairro_nome: "",
                  cidade: "",
                  estado: "",
                  observacao: "",
                });
                setTrocoStr("");
                setForma("pix");
                setCatAtiva(null);
                setPersonProduto(null);
                setIniciado(false);

                if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Voltar ao cardápio
            </Button>
          </div>
        </div>
      )}

      {/* HEADER compacto */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-3 py-1.5">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary grid place-items-center shrink-0 overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="size-full object-cover" />
              ) : (
                <ChefHat className="size-4 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[15px] leading-tight truncate">
                {data.empresa.nome}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 leading-tight">
                {abertoInfo.aberto ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                    Aberto
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                    <span className="size-1.5 rounded-full bg-destructive" />
                    Fechado
                    {data.empresa.horario_ativo && abertoInfo.dia.abre
                      ? ` · ${abertoInfo.dia.abre}`
                      : ""}
                  </span>
                )}
                {abertoInfo.aberto && cfgDel.aceita_entrega && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Bike className="size-2.5" />
                    {(() => {
                      const min = Number(cfgDel.tempo_entrega_min || 0);
                      const max = Number(cfgDel.tempo_entrega_max || 0);
                      if (cfgDel.exibir_tempo_estimado !== false && (min || max)) {
                        return min && max && min !== max
                          ? `${min}–${max} min`
                          : `~${min || max} min`;
                      }
                      return "Entrega";
                    })()}
                    {cfgDel.cobrar_taxa_entrega && Number(cfgDel.taxa_entrega) > 0 && (
                      <span className="opacity-70">· {fmt(Number(cfgDel.taxa_entrega))}</span>
                    )}
                  </span>
                )}
                {abertoInfo.aberto && cfgDel.aceita_retirada && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Store className="size-2.5" />
                    {(() => {
                      const min = Number(cfgDel.tempo_retirada_min || 0);
                      const max = Number(cfgDel.tempo_retirada_max || 0);
                      if (cfgDel.exibir_tempo_estimado !== false && (min || max)) {
                        return min && max && min !== max
                          ? `${min}–${max} min`
                          : `~${min || max} min`;
                      }
                      return "Retirada";
                    })()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de contexto: categoria selecionada + busca */}
        {abertoInfo.aberto && catAtiva && (
          <div className="border-t border-border/60 bg-background/95">
            <div className="max-w-2xl mx-auto px-3 py-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCatAtiva(null);
                  setBusca("");
                }}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[12px] font-semibold bg-muted hover:bg-muted/70"
              >
                <ArrowLeft className="size-3.5" /> Categorias
              </button>
              <div className="font-display text-sm truncate flex-1">{categoriaAtiva?.nome}</div>
              <div className="text-[11px] text-muted-foreground">{produtosDaCategoria.length}</div>
            </div>
            {produtosDaCategoria.length > 6 && (
              <div className="max-w-2xl mx-auto px-3 pb-2">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar nesta categoria"
                    className="h-8 pl-8 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-3 py-3 space-y-2">
        {!abertoInfo.aberto ? (
          <Card className="p-4 bg-destructive/5 border-destructive/30 text-center text-destructive">
            <div className="font-semibold mb-1">Estamos fechados no momento</div>
            <div className="text-sm">Confira nosso horário de funcionamento e volte em breve.</div>
          </Card>
        ) : !catAtiva ? (
          <>
            <div className="pt-2 pb-1">
              <h2 className="font-display text-xl leading-tight">O que você deseja pedir?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha uma categoria para ver os produtos.
              </p>
            </div>
            {categoriasComContagem.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                Nenhuma categoria disponível no momento.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {categoriasComContagem.map((c) => {
                  const emoji = iconeCategoria(c.nome);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCatAtiva(c.id);
                        setBusca("");
                        if (typeof window !== "undefined") window.scrollTo({ top: 0 });
                      }}
                      className="group aspect-[4/3] rounded-2xl bg-card border border-border hover:border-primary/60 active:scale-[0.98] transition shadow-sm p-3 flex flex-col items-center justify-center gap-2 text-center"
                    >
                      <div
                        className="size-14 rounded-2xl bg-primary/10 grid place-items-center text-3xl leading-none group-hover:bg-primary/20 transition"
                        aria-hidden
                      >
                        {emoji}
                      </div>
                      <div className="min-w-0 w-full">
                        <div className="font-semibold text-sm leading-tight line-clamp-2">
                          {c.nome}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {c._count} {c._count === 1 ? "opção" : "opções"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            {buscaNorm
              ? "Nenhum produto encontrado nesta busca."
              : "Nenhum produto nesta categoria."}
          </div>
        ) : (
          produtosFiltrados.map((p) => {
            const cat = categorias.find((c) => c.id === p.categoria_id);
            const emoji = iconeCategoria(cat?.nome);
            const personalizavel = p.tem_adicionais && gruposDoProduto(p.id).length > 0;
            const qtdAtual = simpleQty(p.id);
            return (
              <div
                key={p.id}
                className="w-full min-h-[62px] bg-card border border-border rounded-xl px-2 py-1.5 flex gap-2 items-center hover:border-primary/40 transition"
              >
                <button
                  type="button"
                  onClick={() => handleAdd(p)}
                  className="flex gap-2 items-center flex-1 min-w-0 text-left h-full"
                  aria-label={`Adicionar ${p.nome}`}
                >
                  {p.imagem_url ? (
                    <img
                      src={p.imagem_url}
                      alt={p.nome}
                      loading="lazy"
                      className="size-11 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="size-11 rounded-lg bg-muted grid place-items-center shrink-0 text-xl leading-none"
                      aria-hidden
                    >
                      {emoji}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] leading-tight line-clamp-1">
                      {p.nome}
                    </div>
                    {p.descricao && (
                      <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                        {p.descricao}
                      </div>
                    )}
                    <div className="text-primary font-bold text-[13px] leading-tight mt-0.5">
                      {fmt(p.preco)}
                    </div>
                  </div>
                </button>
                {personalizavel || qtdAtual === 0 ? (
                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    aria-label={`Adicionar ${p.nome}`}
                    className="shrink-0 grid place-items-center size-9 rounded-full bg-primary text-primary-foreground shadow shadow-primary/30 active:scale-95 transition"
                  >
                    <Plus className="size-4" strokeWidth={2.8} />
                  </button>
                ) : (
                  <div className="shrink-0 flex items-center gap-0.5 rounded-full bg-primary/10 p-0.5">
                    <button
                      type="button"
                      onClick={() => decSimple(p.id)}
                      className="grid place-items-center size-7 rounded-full bg-background text-primary border border-primary/30"
                      aria-label="Diminuir"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="min-w-[18px] text-center text-[13px] font-bold text-primary">
                      {qtdAtual}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdd(p)}
                      className="grid place-items-center size-7 rounded-full bg-primary text-primary-foreground"
                      aria-label="Aumentar"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      {/* Barra flutuante do carrinho */}
      {totalItens > 0 && (
        <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-0 right-0 z-30 px-3 pointer-events-none">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setReviewOpen(true)}
              className="group pointer-events-auto animate-scale-in w-full min-h-16 flex items-center gap-3 rounded-[20px] border border-border bg-card p-2.5 text-card-foreground shadow-[0_16px_48px_rgba(0,0,0,0.55)] transition hover:border-primary/50 active:scale-[0.985]"
              aria-label={`Revisar pedido com ${totalItens} ${totalItens === 1 ? "item" : "itens"}. Total ${fmt(totalCart)}`}
            >
              <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <ShoppingBag className="size-5" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 grid min-w-5 h-5 place-items-center rounded-full border-2 border-card bg-primary-foreground px-1 text-[10px] font-extrabold text-primary">
                  {totalItens}
                </span>
              </span>
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span className="block text-[15px] font-extrabold">Revisar pedido</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {totalItens} {totalItens === 1 ? "item adicionado" : "itens adicionados"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 pl-2">
                <span className="text-right">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <span className="block text-base font-extrabold text-primary">
                    {fmt(totalCart)}
                  </span>
                </span>
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal personalização */}
      <PersonalizarModal
        produto={personProduto}
        itemInicial={editingItem}
        grupos={personProduto ? gruposDoProduto(personProduto.id) : []}
        onClose={() => {
          setPersonProduto(null);
          setEditingItem(null);
          setTimeout(() => setReviewOpen(true), 0);
        }}
        onConfirm={(item) => {
          setCart((c) =>
            editingItem
              ? c.map((current) => (current.key === editingItem.key ? item : current))
              : [...c, item],
          );
          setPersonProduto(null);
          setEditingItem(null);
        }}
      />

      {/* Bottom Sheet - Carrinho */}
      <Sheet open={reviewOpen} onOpenChange={setReviewOpen}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[85vh] sm:rounded-t-3xl flex flex-col p-0 gap-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-3" />
            <SheetTitle className="text-lg text-left">Seu pedido</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
            {cart.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Seu carrinho está vazio.
              </div>
            )}
            {cart.map((it) => {
              const un =
                it.preco_base + it.adicionais.reduce((s, a) => s + a.preco * a.quantidade, 0);
              return (
                <div key={it.key} className="rounded-xl border border-border p-3">
                  <div className="flex items-start gap-3">
                    {it.imagem ? (
                      <img
                        src={it.imagem}
                        alt=""
                        className="size-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-14 rounded-lg bg-muted grid place-items-center shrink-0">
                        <Utensils className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{it.nome}</div>
                      {it.adicionais.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {it.adicionais
                            .map((a) => `${a.quantidade}× ${a.adicional_nome}`)
                            .join(" · ")}
                        </div>
                      )}
                      {it.observacao && (
                        <div className="text-[11px] italic text-muted-foreground mt-0.5">
                          "{it.observacao}"
                        </div>
                      )}
                      <div className="text-primary font-bold text-sm mt-1">
                        {fmt(un * it.quantidade)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const produto = data.produtos.find((p) => p.id === it.produto_id);
                        if (!produto) return;
                        setEditingItem(it);
                        setPersonProduto(produto);
                        setReviewOpen(false);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-primary shrink-0"
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => removeCartItem(it.key)}
                      className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <div className="text-[11px] text-muted-foreground">Un.: {fmt(un)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQtd(it.key, -1)}
                        className="grid place-items-center size-8 rounded-full border border-border hover:bg-muted"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{it.quantidade}</span>
                      <button
                        onClick={() => changeQtd(it.key, +1)}
                        className="grid place-items-center size-8 rounded-full bg-primary text-primary-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border p-5 space-y-3 bg-background">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmt(totalCart)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-display text-lg">Total</span>
              <span className="font-display text-2xl text-primary">{fmt(totalCart)}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-full"
              onClick={() => setReviewOpen(false)}
            >
              <ArrowLeft className="size-4 mr-2" />
              Continuar comprando
            </Button>
            <Button
              className="w-full h-12 rounded-full text-base font-semibold"
              disabled={!abertoInfo.aberto || cart.length === 0}
              onClick={() => {
                setReviewOpen(false);
                abrirCheckout();
              }}
            >
              {abertoInfo.aberto ? "Continuar" : "Estabelecimento fechado"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog - Escolha tipo entrega */}
      <Dialog open={tipoOpen} onOpenChange={setTipoOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Como deseja receber seu pedido?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setTipoOpen(false);
                setReviewOpen(true);
              }}
            >
              <ArrowLeft className="size-4 mr-2" /> Voltar ao pedido
            </Button>
            {cfgDel.aceita_retirada && (
              <button
                onClick={() => {
                  setTipo("retirada");
                  setTipoOpen(false);
                  setCheckoutOpen(true);
                }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border p-4 hover:border-primary text-left transition"
              >
                <div className="grid place-items-center size-12 rounded-xl bg-primary/10 text-primary">
                  <Store className="size-6" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Retirada</div>
                  <div className="text-xs text-muted-foreground">Buscar no estabelecimento</div>
                </div>
              </button>
            )}
            {cfgDel.aceita_entrega && (
              <button
                onClick={() => {
                  setTipo("entrega");
                  setTipoOpen(false);
                  setCheckoutOpen(true);
                }}
                className="flex items-center gap-3 rounded-2xl border-2 border-border p-4 hover:border-primary text-left transition"
              >
                <div className="grid place-items-center size-12 rounded-xl bg-primary/10 text-primary">
                  <Bike className="size-6" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Entrega</div>
                  <div className="text-xs text-muted-foreground">Receber no endereço</div>
                </div>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Sheet - Checkout */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] flex flex-col p-0 gap-0">
          <SheetHeader className="px-4 pt-3 pb-2 border-b border-border">
            <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30 mb-2" />
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setCheckoutOpen(false);
                  setReviewOpen(true);
                }}
                aria-label="Voltar ao pedido"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <SheetTitle className="text-base text-left">Finalizar pedido</SheetTitle>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {mostraTipoStep && (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted">
                <button
                  onClick={() => setTipo("retirada")}
                  className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${tipo === "retirada" ? "bg-background shadow" : "text-muted-foreground"}`}
                >
                  <Store className="size-3.5" /> Retirada
                </button>
                <button
                  onClick={() => setTipo("entrega")}
                  className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${tipo === "entrega" ? "bg-background shadow" : "text-muted-foreground"}`}
                >
                  <Bike className="size-3.5" /> Entrega
                </button>
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dados
              </h3>
              <Input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Seu nome *"
                maxLength={80}
                className="h-9 rounded-lg text-sm"
              />
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskWhats(e.target.value))}
                onBlur={(e) => buscarClienteWA(e.target.value)}
                placeholder="WhatsApp * — (11) 99999-9999"
                inputMode="numeric"
                className="h-9 rounded-lg text-sm"
              />
            </section>

            {tipo === "entrega" && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" /> Endereço
                </h3>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Input
                    value={endereco.rua}
                    onChange={(e) => setEndereco((x) => ({ ...x, rua: e.target.value }))}
                    placeholder="Rua *"
                    className="h-9 rounded-lg text-sm"
                  />
                  <Input
                    value={endereco.numero}
                    onChange={(e) => setEndereco((x) => ({ ...x, numero: e.target.value }))}
                    placeholder="Nº *"
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                {bairros.length > 0 ? (
                  <Select
                    value={endereco.bairro_id ?? ""}
                    onValueChange={(v) => {
                      const b = bairros.find((x) => x.id === v);
                      setEndereco((x) => ({ ...x, bairro_id: v, bairro_nome: b?.nome ?? "" }));
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg text-sm">
                      <SelectValue placeholder="Bairro *" />
                    </SelectTrigger>
                    <SelectContent>
                      {bairros.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.nome}{" "}
                          {cfgDel.cobrar_taxa_entrega ? `— ${fmt(Number(b.valor_frete))}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={endereco.bairro_nome}
                    onChange={(e) => setEndereco((x) => ({ ...x, bairro_nome: e.target.value }))}
                    placeholder="Bairro *"
                    className="h-9 rounded-lg text-sm"
                  />
                )}
                <Input
                  value={endereco.complemento}
                  onChange={(e) => setEndereco((x) => ({ ...x, complemento: e.target.value }))}
                  placeholder="Complemento (opcional)"
                  className="h-9 rounded-lg text-sm"
                />
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-primary" /> Pagamento
              </h3>
              <RadioGroup
                value={forma}
                onValueChange={(v) => setForma(v as FormaPagamento)}
                className="grid grid-cols-3 gap-1.5"
              >
                {(["pix", "dinheiro", "cartao_entrega"] as FormaPagamento[]).map((f) => (
                  <label
                    key={f}
                    className={`flex items-center justify-center rounded-lg border py-2 px-1 cursor-pointer text-center ${forma === f ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem value={f} className="sr-only" />
                    <span className="text-[11px] font-medium leading-tight">{FORMA_LABEL[f]}</span>
                  </label>
                ))}
              </RadioGroup>
              {forma === "dinheiro" && (
                <Input
                  value={trocoStr}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const num = (Number(digits) / 100).toFixed(2).replace(".", ",");
                    setTrocoStr(digits ? `R$ ${num}` : "");
                  }}
                  placeholder="Troco para (opcional)"
                  inputMode="numeric"
                  className="h-9 rounded-lg text-sm"
                />
              )}
            </section>
          </div>
          <div className="border-t border-border px-4 pt-2 pb-3 bg-background space-y-2">
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(totalCart)}</span>
              </div>
              {tipo === "entrega" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrega</span>
                  <span>{taxaEntrega > 0 ? fmt(taxaEntrega) : "—"}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-0.5">
                <span className="font-display text-sm">Total</span>
                <span className="font-display text-lg text-primary">{fmt(totalFinal)}</span>
              </div>
            </div>
            <Button
              className="w-full h-11 rounded-full text-sm font-semibold"
              onClick={enviar}
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <ShoppingBag className="size-4 mr-2" />
              )}
              Enviar pedido
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CatChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-7 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted text-foreground hover:bg-muted/70"
      }`}
    >
      {label}
      {typeof count === "number" ? (
        <span
          className={`ml-1 text-[10px] font-medium ${active ? "opacity-80" : "text-muted-foreground"}`}
        >
          ({count})
        </span>
      ) : null}
    </button>
  );
}

function PersonalizarModal({
  produto,
  grupos,
  itemInicial,
  onClose,
  onConfirm,
}: {
  produto: Produto | null;
  grupos: Grupo[];
  itemInicial?: CartItem | null;
  onClose: () => void;
  onConfirm: (item: CartItem) => void;
}) {
  const [sel, setSel] = useState<Record<string, Record<string, number>>>({});
  const [obs, setObs] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [qtd, setQtd] = useState(1);

  useEffect(() => {
    if (!produto) return;
    const inicial: Record<string, Record<string, number>> = {};
    for (const adicional of itemInicial?.adicionais ?? []) {
      inicial[adicional.grupo_id] ??= {};
      inicial[adicional.grupo_id][adicional.adicional_id] = adicional.quantidade;
    }
    setSel(inicial);
    setObs(itemInicial?.observacao ?? "");
    setQtd(itemInicial?.quantidade ?? 1);
    const first = grupos.find((g) => g.obrigatorio)?.id ?? grupos[0]?.id;
    setOpenGroups(first ? { [first]: true } : {});
  }, [produto?.id, itemInicial?.key]); // eslint-disable-line

  const extras = useMemo(() => {
    const out: AdicionalSel[] = [];
    grupos.forEach((g) => {
      let gratuitas = Math.max(0, g.qtd_inclusa ?? 0);
      Object.entries(sel[g.id] ?? {}).forEach(([iid, q]) => {
        const it = g.adicionais.find((x) => x.id === iid);
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
  }, [sel, grupos]);

  if (!produto) return null;

  const totalDoGrupo = (gid: string) => Object.values(sel[gid] ?? {}).reduce((a, b) => a + b, 0);
  const maxG = (g: Grupo) => (g.max_ilimitado ? LIMIT_UNLIMITED : g.max_selecao);

  const setQ = (g: Grupo, iid: string, q: number) =>
    setSel((prev) => {
      const cur = { ...(prev[g.id] ?? {}) };
      if (q <= 0) delete cur[iid];
      else cur[iid] = q;
      return { ...prev, [g.id]: cur };
    });

  const toggleUnica = (g: Grupo, iid: string) =>
    setSel((prev) => ({
      ...prev,
      [g.id]: prev[g.id]?.[iid] && !g.obrigatorio ? {} : { [iid]: 1 },
    }));
  const toggleMultipla = async (g: Grupo, iid: string) => {
    const atuais = sel[g.id] ?? {};
    const totalAtual = Object.values(atuais).reduce((a, b) => a + b, 0);
    const item = g.adicionais.find((x) => x.id === iid);
    if (!atuais[iid] && totalAtual >= g.qtd_inclusa && Number(item?.preco ?? 0) > 0) {
      const confirmou = await confirmDialog({
        title: "Acréscimo na segunda escolha",
        description: `Ao adicionar ${item?.nome}, será acrescentado ${fmt(Number(item?.preco ?? 0))} ao pedido.`,
        confirmText: "Adicionar com acréscimo",
        cancelText: "Cancelar",
        destructive: false,
      });
      if (!confirmou) return;
    }
    setSel((prev) => {
      const cur = { ...(prev[g.id] ?? {}) };
      if (cur[iid]) delete cur[iid];
      else {
        if (Object.values(cur).reduce((a, b) => a + b, 0) >= maxG(g)) return prev;
        cur[iid] = 1;
      }
      return { ...prev, [g.id]: cur };
    });
  };

  const somaExtras = extras.reduce((s, x) => s + x.preco * x.quantidade, 0);
  const total = (produto.preco + somaExtras) * qtd;

  const rotulo = (g: Grupo) => {
    if (g.tipo_selecao === "unica") return g.obrigatorio ? "Escolha 1 • Obrigatório" : "Escolha 1";
    if (g.max_ilimitado)
      return g.obrigatorio ? "Escolha quantos desejar • Obrigatório" : "Escolha quantos desejar";
    const base = `Escolha até ${g.max_selecao}`;
    const min = g.min_selecao > 0 ? ` • mín ${g.min_selecao}` : "";
    return `${base}${min}${g.obrigatorio ? " • Obrigatório" : ""}`;
  };

  const confirmar = () => {
    for (const g of grupos) {
      const n = totalDoGrupo(g.id);
      const min = Math.max(g.obrigatorio ? 1 : 0, g.min_selecao);
      if (n < min) {
        toast.error(`"${g.nome}": selecione no mínimo ${min}`);
        setOpenGroups((p) => ({ ...p, [g.id]: true }));
        setTimeout(() => {
          document
            .querySelector(`[data-grupo-id="${g.id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 60);
        return;
      }
    }
    onConfirm({
      key: itemInicial?.key ?? `${produto.id}::${createClientId()}`,
      produto_id: produto.id,
      nome: produto.nome,
      preco_base: produto.preco,
      quantidade: qtd,
      adicionais: extras,
      observacao: obs.trim(),
      imagem: produto.imagem_url,
    });
  };

  return (
    <Dialog open={!!produto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="p-0 gap-0 max-w-lg w-[calc(100vw-1rem)] sm:w-full h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <DialogTitle className="sr-only">Personalizar {produto.nome}</DialogTitle>
        <div className="shrink-0 border-b border-border px-3 py-2 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{produto.nome}</p>
            <p className="text-[11px] text-muted-foreground">
              Base: <span className="text-foreground">{fmt(produto.preco)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 grid place-items-center size-8 rounded-md hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
          {grupos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Sem grupos vinculados.</p>
          )}
          {grupos.map((g) => {
            const isOpen = !!openGroups[g.id];
            const totalG = totalDoGrupo(g.id);
            const minReq = Math.max(g.obrigatorio ? 1 : 0, g.min_selecao);
            const ok = totalG >= minReq;
            const cheio = totalG >= maxG(g);
            const badge = g.max_ilimitado ? `${totalG}` : `${totalG}/${g.max_selecao}`;
            const cur = sel[g.id] ?? {};
            return (
              <div
                key={g.id}
                data-grupo-id={g.id}
                className="rounded-lg border border-border overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !p[g.id] }))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {g.nome}
                      {g.obrigatorio && <span className="text-destructive ml-1">*</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {rotulo(g)}
                      {g.qtd_inclusa > 0
                        ? ` • ${g.qtd_inclusa} incluída${g.qtd_inclusa === 1 ? "" : "s"} no preço`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full border ${ok ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    {badge}
                    {ok && <Check className="inline size-3 ml-1 -mt-0.5" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 space-y-1">
                    {g.adicionais.map((it) => {
                      const q = cur[it.id] ?? 0;
                      const checked = q > 0;
                      if (g.tipo_selecao === "quantidade") {
                        return (
                          <div
                            key={it.id}
                            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${checked ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                          >
                            <span className="flex-1 truncate">{it.nome}</span>
                            <span
                              className={`text-xs shrink-0 ${g.qtd_inclusa === 0 && it.preco > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}
                            >
                              {g.qtd_inclusa === 0 && it.preco > 0 ? `+${fmt(it.preco)}` : ""}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="size-7"
                                onClick={() => setQ(g, it.id, Math.max(0, q - 1))}
                                disabled={q <= 0}
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <span className="w-6 text-center text-sm font-medium">{q}</span>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="size-7"
                                onClick={() => setQ(g, it.id, q + 1)}
                                disabled={cheio}
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
                          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm cursor-pointer transition ${checked ? "border-primary bg-primary/5" : "border-border bg-card"} ${bloq ? "opacity-50 cursor-not-allowed" : ""}`}
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
                            {g.qtd_inclusa === 0 && it.preco > 0 ? `+${fmt(it.preco)}` : ""}
                          </span>
                        </div>
                      );
                    })}
                    {g.adicionais.length === 0 && (
                      <p className="text-xs text-muted-foreground py-1 px-1">Sem itens.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-lg border border-border p-2">
            <Label className="text-xs">Observação</Label>
            <Textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: sem cebola"
              maxLength={200}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border px-3 py-2 bg-background space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setQtd((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-8 text-center font-semibold">{qtd}</span>
              <Button size="icon" variant="outline" onClick={() => setQtd((q) => q + 1)}>
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-muted-foreground">Total</div>
              <div className="font-display text-xl text-primary">{fmt(total)}</div>
            </div>
          </div>
          <Button onClick={confirmar} className="w-full h-11">
            Adicionar ao pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
