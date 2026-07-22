import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Bike } from "lucide-react";
import { toast } from "sonner";

type Config = {
  id: string;
  delivery_retirada_ativo: boolean;
  aceita_retirada: boolean;
  aceita_entrega: boolean;
  cobrar_taxa_entrega: boolean;
  pedido_minimo: number;
  tempo_preparo_min: number;
  exibir_cardapio_online: boolean;
  taxa_entrega: number;
  exibir_tempo_estimado: boolean;
  tempo_entrega_min: number | null;
  tempo_entrega_max: number | null;
  tempo_retirada_min: number | null;
  tempo_retirada_max: number | null;
};

export function DeliveryTab() {
  const { empresa } = useAuth();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!empresa?.id) {
      setCfg(null);
      setLoadError("Nenhuma empresa vinculada ao usuário atual.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc("get_configuracoes_completo");
    const row = Array.isArray(data) ? data[0] : data;

    if (error) {
      setCfg(null);
      setLoadError(error.message);
    } else if (!row) {
      setCfg(null);
      setLoadError("As configurações desta empresa ainda não foram criadas.");
    } else {
      setCfg(row as unknown as Config);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [empresa?.id]);

  const salvar = async () => {
    if (!cfg) return;
    setSaving(true);
    const patch = {
      delivery_retirada_ativo: cfg.delivery_retirada_ativo,
      aceita_retirada: cfg.aceita_retirada,
      aceita_entrega: cfg.aceita_entrega,
      cobrar_taxa_entrega: cfg.cobrar_taxa_entrega,
      pedido_minimo: Number(cfg.pedido_minimo) || 0,
      tempo_preparo_min: Number(cfg.tempo_preparo_min) || 30,
      exibir_cardapio_online: cfg.exibir_cardapio_online,
      taxa_entrega: Number(cfg.taxa_entrega) || 0,
      exibir_tempo_estimado: cfg.exibir_tempo_estimado,
      tempo_entrega_min:
        cfg.tempo_entrega_min == null ? null : Number(cfg.tempo_entrega_min) || null,
      tempo_entrega_max:
        cfg.tempo_entrega_max == null ? null : Number(cfg.tempo_entrega_max) || null,
      tempo_retirada_min:
        cfg.tempo_retirada_min == null ? null : Number(cfg.tempo_retirada_min) || null,
      tempo_retirada_max:
        cfg.tempo_retirada_max == null ? null : Number(cfg.tempo_retirada_max) || null,
    };
    const { error } = await supabase
      .from("configuracoes")
      .update(patch as never)
      .eq("id", cfg.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configurações salvas");
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!cfg) {
    return (
      <Card className="p-6 text-center space-y-3">
        <p className="text-sm text-destructive">
          {loadError ?? "Não foi possível carregar as configurações."}
        </p>
        <Button variant="outline" onClick={() => void load()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <Bike className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl">Delivery & Retirada</h2>
            <p className="text-xs text-muted-foreground">
              Configure como sua loja recebe pedidos pelo cardápio online.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            <Row
              label="Ativar módulo Delivery & Retirada"
              help="Habilita as opções abaixo no cardápio público."
            >
              <Switch
                checked={cfg.delivery_retirada_ativo}
                onCheckedChange={(v) => setCfg({ ...cfg, delivery_retirada_ativo: v })}
              />
            </Row>
            <Row label="Exibir cardápio online">
              <Switch
                checked={cfg.exibir_cardapio_online}
                onCheckedChange={(v) => setCfg({ ...cfg, exibir_cardapio_online: v })}
              />
            </Row>
            <Row label="Aceita retirada no balcão">
              <Switch
                checked={cfg.aceita_retirada}
                onCheckedChange={(v) => setCfg({ ...cfg, aceita_retirada: v })}
              />
            </Row>
            <Row label="Aceita entrega">
              <Switch
                checked={cfg.aceita_entrega}
                onCheckedChange={(v) => setCfg({ ...cfg, aceita_entrega: v })}
              />
            </Row>
            <Row
              label="Cobrar taxa de entrega"
              help="Se desativado, o frete não será somado ao total."
            >
              <Switch
                checked={cfg.cobrar_taxa_entrega}
                onCheckedChange={(v) => setCfg({ ...cfg, cobrar_taxa_entrega: v })}
              />
            </Row>
            <Row
              label="Exibir tempo estimado"
              help="Mostra o tempo estimado no cardápio e na confirmação."
            >
              <Switch
                checked={cfg.exibir_tempo_estimado}
                onCheckedChange={(v) => setCfg({ ...cfg, exibir_tempo_estimado: v })}
              />
            </Row>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 pt-3 border-t border-border">
            <NumField
              label="Taxa de entrega (R$)"
              step="0.01"
              value={cfg.taxa_entrega ?? 0}
              onChange={(v) => setCfg({ ...cfg, taxa_entrega: v ?? 0 })}
            />
            <NumField
              label="Pedido mínimo (R$)"
              step="0.01"
              value={cfg.pedido_minimo}
              onChange={(v) => setCfg({ ...cfg, pedido_minimo: v ?? 0 })}
            />
            <NumField
              label="Preparo (min)"
              value={cfg.tempo_preparo_min}
              onChange={(v) => setCfg({ ...cfg, tempo_preparo_min: v ?? 0 })}
            />
            <NumField
              label="Entrega mín (min)"
              placeholder="30"
              nullable
              value={cfg.tempo_entrega_min}
              onChange={(v) => setCfg({ ...cfg, tempo_entrega_min: v })}
            />
            <NumField
              label="Entrega máx (min)"
              placeholder="45"
              nullable
              value={cfg.tempo_entrega_max}
              onChange={(v) => setCfg({ ...cfg, tempo_entrega_max: v })}
            />
            <NumField
              label="Retirada mín (min)"
              placeholder="15"
              nullable
              value={cfg.tempo_retirada_min}
              onChange={(v) => setCfg({ ...cfg, tempo_retirada_min: v })}
            />
            <NumField
              label="Retirada máx (min)"
              placeholder="25"
              nullable
              value={cfg.tempo_retirada_max}
              onChange={(v) => setCfg({ ...cfg, tempo_retirada_max: v })}
            />
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Salvar configurações
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {help && <div className="text-[11px] text-muted-foreground">{help}</div>}
      </div>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  step,
  nullable,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: string;
  nullable?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min="0"
        step={step}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === "") onChange(nullable ? null : 0);
          else onChange(Number(e.target.value));
        }}
        className="h-9"
      />
    </div>
  );
}
