import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Building2, MapPin, Settings2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type EmpresaForm = {
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  inscricao_estadual: string;
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
};

type ConfigForm = {
  qtd_comandas: number;
  tipo_numeracao: string;
  pin_diario_ativo: boolean;
  horario_ativo: boolean;
};

const STEPS = [
  { id: 1, label: "Empresa", icon: Building2 },
  { id: 2, label: "Endereço", icon: MapPin },
  { id: 3, label: "Operação", icon: Settings2 },
  { id: 4, label: "Pronto", icon: Sparkles },
];

export function OnboardingWizard({ open, onOpenChange }: Props) {
  const { empresa, refreshEmpresa } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [emp, setEmp] = useState<EmpresaForm>({
    nome_fantasia: "",
    razao_social: "",
    cnpj: "",
    inscricao_estadual: "",
    endereco_cep: "",
    endereco_logradouro: "",
    endereco_numero: "",
    endereco_complemento: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
  });
  const [cfg, setCfg] = useState<ConfigForm>({
    qtd_comandas: 50,
    tipo_numeracao: "continua",
    pin_diario_ativo: false,
    horario_ativo: false,
  });

  useEffect(() => {
    if (!open || !empresa?.id) return;
    (async () => {
      const { data: e } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", empresa.id)
        .maybeSingle();
      if (e) {
        setEmp({
          nome_fantasia: e.nome_fantasia ?? "",
          razao_social: e.razao_social ?? "",
          cnpj: e.cnpj ?? "",
          inscricao_estadual: e.inscricao_estadual ?? "",
          endereco_cep: e.endereco_cep ?? "",
          endereco_logradouro: e.endereco_logradouro ?? "",
          endereco_numero: e.endereco_numero ?? "",
          endereco_complemento: e.endereco_complemento ?? "",
          endereco_bairro: e.endereco_bairro ?? "",
          endereco_cidade: e.endereco_cidade ?? "",
          endereco_estado: e.endereco_estado ?? "",
        });
        setStep(Math.max(1, Math.min(4, e.onboarding_etapa ?? 1)));
      }
      const { data: c } = await supabase
        .from("configuracoes")
        .select("*")
        .eq("empresa_id", empresa.id)
        .maybeSingle();
      if (c) {
        setCfg({
          qtd_comandas: c.qtd_comandas ?? 50,
          tipo_numeracao: c.tipo_numeracao ?? "continua",
          pin_diario_ativo: !!c.pin_diario_ativo,
          horario_ativo: !!c.horario_ativo,
        });
      }
    })();
  }, [open, empresa?.id]);

  const saveEmpresa = async (nextStep: number, completo = false) => {
    if (!empresa?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("empresas")
        .update({
          ...emp,
          onboarding_etapa: nextStep,
          onboarding_completo: completo,
        })
        .eq("id", empresa.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!empresa?.id) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .update({
          qtd_comandas: cfg.qtd_comandas,
          tipo_numeracao: cfg.tipo_numeracao,
          pin_diario_ativo: cfg.pin_diario_ativo,
          horario_ativo: cfg.horario_ativo,
        })
        .eq("empresa_id", empresa.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step === 1 || step === 2) {
      const ok = await saveEmpresa(step + 1);
      if (!ok) return;
    } else if (step === 3) {
      const ok = await saveConfig();
      if (!ok) return;
      await saveEmpresa(step + 1);
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const finalize = async () => {
    const ok = await saveEmpresa(4, true);
    if (!ok) return;
    await refreshEmpresa();
    toast.success("Empresa configurada com sucesso!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Configuração inicial da empresa
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-1 my-4">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center">
                <div
                  className={`size-9 rounded-full grid place-items-center transition
                  ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-primary/20 text-primary border border-primary"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="size-5" /> : <Icon className="size-4" />}
                </div>
                <span
                  className={`text-[10px] mt-1 ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dados da sua empresa (opcional, pode preencher depois).
            </p>
            <Field label="Nome Fantasia">
              <Input
                value={emp.nome_fantasia}
                onChange={(e) => setEmp({ ...emp, nome_fantasia: e.target.value })}
              />
            </Field>
            <Field label="Razão Social">
              <Input
                value={emp.razao_social}
                onChange={(e) => setEmp({ ...emp, razao_social: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNPJ">
                <Input
                  value={emp.cnpj}
                  onChange={(e) => setEmp({ ...emp, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="Inscrição Estadual">
                <Input
                  value={emp.inscricao_estadual}
                  onChange={(e) => setEmp({ ...emp, inscricao_estadual: e.target.value })}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Endereço do estabelecimento.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="CEP">
                <Input
                  value={emp.endereco_cep}
                  onChange={(e) => setEmp({ ...emp, endereco_cep: e.target.value })}
                />
              </Field>
              <Field label="Cidade">
                <Input
                  value={emp.endereco_cidade}
                  onChange={(e) => setEmp({ ...emp, endereco_cidade: e.target.value })}
                />
              </Field>
              <Field label="UF">
                <Input
                  value={emp.endereco_estado}
                  onChange={(e) => setEmp({ ...emp, endereco_estado: e.target.value })}
                  maxLength={2}
                />
              </Field>
            </div>
            <Field label="Logradouro">
              <Input
                value={emp.endereco_logradouro}
                onChange={(e) => setEmp({ ...emp, endereco_logradouro: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número">
                <Input
                  value={emp.endereco_numero}
                  onChange={(e) => setEmp({ ...emp, endereco_numero: e.target.value })}
                />
              </Field>
              <Field label="Complemento">
                <Input
                  value={emp.endereco_complemento}
                  onChange={(e) => setEmp({ ...emp, endereco_complemento: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Bairro">
              <Input
                value={emp.endereco_bairro}
                onChange={(e) => setEmp({ ...emp, endereco_bairro: e.target.value })}
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Como você quer operar?</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade de comandas">
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={cfg.qtd_comandas}
                  onChange={(e) => setCfg({ ...cfg, qtd_comandas: Number(e.target.value) || 1 })}
                />
              </Field>
              <Field label="Tipo de numeração">
                <Select
                  value={cfg.tipo_numeracao}
                  onValueChange={(v) => setCfg({ ...cfg, tipo_numeracao: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="continua">Contínua</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <SwitchRow
              label="Ativar PIN diário para garçons"
              checked={cfg.pin_diario_ativo}
              onChange={(v) => setCfg({ ...cfg, pin_diario_ativo: v })}
            />
            <SwitchRow
              label="Ativar restrição por horário de funcionamento"
              checked={cfg.horario_ativo}
              onChange={(v) => setCfg({ ...cfg, horario_ativo: v })}
            />
            <p className="text-xs text-muted-foreground">
              A impressão dos pedidos é manual, feita pelo botão <strong>Imprimir</strong> em cada
              pedido usando a impressora padrão do navegador.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="py-8 text-center space-y-3">
            <div className="size-16 mx-auto rounded-full bg-primary/15 grid place-items-center">
              <CheckCircle2 className="size-10 text-primary" />
            </div>
            <h3 className="font-display text-2xl">Empresa configurada com sucesso!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Tudo pronto. Você pode revisar essas informações a qualquer momento em{" "}
              <strong>Configurações</strong>.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && step < 4 && (
            <Button variant="ghost" disabled={saving} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
          )}
          {step < 4 && (
            <>
              <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                Continuar depois
              </Button>
              <Button disabled={saving} onClick={next}>
                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                {step === 3 ? "Concluir" : "Próximo"}
              </Button>
            </>
          )}
          {step === 4 && (
            <Button disabled={saving} onClick={finalize}>
              {saving && <Loader2 className="size-4 animate-spin mr-2" />}
              Ir para o Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
