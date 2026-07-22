import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Empresa = { id: string; slug: string | null; pedido_online_ativo: boolean };

export function PedidoOnlineTab() {
  const { empresa } = useAuth();
  const [emp, setEmp] = useState<Empresa | null>(null);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!empresa?.id) return;
    const { data, error } = await supabase
      .from("empresas")
      .select("id, slug, pedido_online_ativo")
      .eq("id", empresa.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = data as unknown as Empresa | null;
    setEmp(row);
    setSlug(row?.slug ?? "");
  };
  useEffect(() => {
    load();
  }, [empresa?.id]);

  if (!emp)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  const url = emp.slug ? `${window.location.origin}/cardapio/${emp.slug}` : "";

  const salvarSlug = async () => {
    const clean = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!clean) {
      toast.error("Informe um identificador");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("empresas")
      .update({ slug: clean } as never)
      .eq("id", emp.id);
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "Este link já está em uso" : error.message);
      return;
    }
    setEmp({ ...emp, slug: clean });
    setSlug(clean);
    toast.success("Link salvo");
  };

  const toggle = async (v: boolean) => {
    if (v && !emp.slug) {
      toast.error("Defina um link antes de ativar");
      return;
    }
    setBusy(true);
    const prev = emp;
    setEmp({ ...emp, pedido_online_ativo: v });
    const { error } = await supabase
      .from("empresas")
      .update({ pedido_online_ativo: v } as never)
      .eq("id", emp.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      setEmp(prev);
      return;
    }
    toast.success(v ? "Pedido online ativado" : "Pedido online desativado");
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl">Pedido Online</h2>
            <p className="text-xs text-muted-foreground">
              Publique um link para clientes fazerem pedidos direto pelo celular.
            </p>
          </div>
          <Switch checked={emp.pedido_online_ativo} disabled={busy} onCheckedChange={toggle} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Identificador do link</Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
              <span className="truncate">/cardapio/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="minha-loja"
                className="border-0 focus-visible:ring-0 px-1 text-foreground"
              />
            </div>
            <Button onClick={salvarSlug} disabled={busy}>
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use apenas letras, números e hífens. Deve ser único no sistema.
          </p>
        </div>

        {emp.slug && (
          <div className="mt-4 space-y-2">
            <Label className="text-xs">Seu link público</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  toast.success("Copiado");
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
            {!emp.pedido_online_ativo && (
              <p className="text-xs text-amber-500">
                Link cadastrado, mas desativado. Ative para receber pedidos.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
