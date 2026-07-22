import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Save,
  KeyRound,
  Building2,
  MapPin,
  Users,
  Check,
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EquipeTab } from "@/components/admin/EquipeTab";

// ---------- helpers ----------
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const maskCPF = (s: string) =>
  onlyDigits(s)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCNPJ = (s: string) =>
  onlyDigits(s)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
const maskCEP = (s: string) =>
  onlyDigits(s)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
const maskPhone = (s: string) => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

type Empresa = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  telefone_comercial: string | null;
  whatsapp_empresa: string | null;
  email_comercial: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  logo_url: string | null;
};

function Field({
  label,
  required,
  children,
  hint,
  span,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  span?: 1 | 2 | 3;
}) {
  const spanCls = span === 3 ? "xl:col-span-3 md:col-span-2" : span === 2 ? "md:col-span-2" : "";
  return (
    <div className={`min-w-0 ${spanCls}`}>
      <Label className="text-xs font-semibold">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </Label>
      <div className="mt-1 min-w-0">
        {children}
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-3 mb-4 pb-3 border-b border-border">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-lg leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
        {children}
      </div>
    </Card>
  );
}

export function EmpresaTab() {
  return (
    <Tabs defaultValue="empresa" className="w-full">
      <TabsList className="grid grid-cols-3 w-full sm:w-auto h-auto p-1">
        <TabsTrigger value="empresa" className="gap-2 py-2">
          <Building2 className="size-4" />
          Empresa
        </TabsTrigger>
        <TabsTrigger value="acesso" className="gap-2 py-2">
          <KeyRound className="size-4" />
          Acesso
        </TabsTrigger>
        <TabsTrigger value="usuarios" className="gap-2 py-2">
          <Users className="size-4" />
          Usuários
        </TabsTrigger>
      </TabsList>

      <TabsContent value="empresa" className="mt-6">
        <EmpresaPanel />
      </TabsContent>
      <TabsContent value="acesso" className="mt-6">
        <AcessoPanel />
      </TabsContent>
      <TabsContent value="usuarios" className="mt-6">
        <EquipeTab />
      </TabsContent>
    </Tabs>
  );
}

// ============ Empresa (todos os dados da empresa) ============
function EmpresaPanel() {
  const { emp, setEmp, save, busy, loading } = useEmpresa();
  const [cepBusy, setCepBusy] = useState(false);

  const buscarCep = async () => {
    const cep = onlyDigits(emp?.endereco_cep ?? "");
    if (cep.length !== 8) return;
    setCepBusy(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setEmp({
        endereco_logradouro: data.logradouro ?? "",
        endereco_bairro: data.bairro ?? "",
        endereco_cidade: data.localidade ?? "",
        endereco_estado: data.uf ?? "",
      });
      toast.success("Endereço preenchido");
    } catch {
      toast.error("Falha ao consultar CEP");
    } finally {
      setCepBusy(false);
    }
  };

  if (loading || !emp) return <LoadingState />;

  const emailOk = !emp.email_comercial || isEmail(emp.email_comercial);
  const canSave = !!emp.nome_fantasia && !!emp.whatsapp_empresa && !!emp.email_comercial && emailOk;

  return (
    <div className="space-y-6">
      <SectionCard
        icon={Building2}
        title="Dados da Empresa"
        subtitle="Identificação e contato do estabelecimento."
      >
        <Field label="Nome Fantasia" required span={2}>
          <Input
            value={emp.nome_fantasia ?? ""}
            onChange={(e) => setEmp({ nome_fantasia: e.target.value })}
          />
        </Field>
        <Field label="Razão Social">
          <Input
            value={emp.razao_social ?? ""}
            onChange={(e) => setEmp({ razao_social: e.target.value })}
          />
        </Field>
        <Field label="CNPJ">
          <Input
            value={emp.cnpj ?? ""}
            placeholder="00.000.000/0000-00"
            onChange={(e) => setEmp({ cnpj: maskCNPJ(e.target.value) })}
          />
        </Field>
        <Field label="Inscrição Estadual" hint="Opcional">
          <Input
            value={emp.inscricao_estadual ?? ""}
            placeholder="Isento"
            onChange={(e) => setEmp({ inscricao_estadual: e.target.value })}
          />
        </Field>
        <Field label="Telefone Comercial">
          <Input
            value={emp.telefone_comercial ?? ""}
            placeholder="(00) 0000-0000"
            onChange={(e) => setEmp({ telefone_comercial: maskPhone(e.target.value) })}
          />
        </Field>
        <Field label="WhatsApp da Empresa" required>
          <Input
            value={emp.whatsapp_empresa ?? ""}
            placeholder="(00) 00000-0000"
            onChange={(e) => setEmp({ whatsapp_empresa: maskPhone(e.target.value) })}
          />
        </Field>
        <Field label="E-mail Comercial" required span={2}>
          <Input
            type="email"
            value={emp.email_comercial ?? ""}
            onChange={(e) => setEmp({ email_comercial: e.target.value })}
            aria-invalid={!emailOk}
          />
          {!emailOk && <p className="text-[11px] text-destructive mt-1">E-mail inválido</p>}
        </Field>
      </SectionCard>

      <LogoSection logoUrl={emp.logo_url} onChange={(v) => setEmp({ logo_url: v })} />

      <SectionCard
        icon={MapPin}
        title="Endereço"
        subtitle="Informe o CEP para preencher automaticamente."
      >
        <Field label="CEP">
          <div className="flex gap-2">
            <Input
              value={emp.endereco_cep ?? ""}
              placeholder="00000-000"
              onChange={(e) => setEmp({ endereco_cep: maskCEP(e.target.value) })}
              onBlur={buscarCep}
            />
            <Button type="button" variant="outline" onClick={buscarCep} disabled={cepBusy}>
              {cepBusy ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
        </Field>
        <Field label="Logradouro" span={2}>
          <Input
            value={emp.endereco_logradouro ?? ""}
            onChange={(e) => setEmp({ endereco_logradouro: e.target.value })}
          />
        </Field>
        <Field label="Número">
          <Input
            value={emp.endereco_numero ?? ""}
            onChange={(e) => setEmp({ endereco_numero: e.target.value })}
          />
        </Field>
        <Field label="Complemento" span={2}>
          <Input
            value={emp.endereco_complemento ?? ""}
            onChange={(e) => setEmp({ endereco_complemento: e.target.value })}
          />
        </Field>
        <Field label="Bairro">
          <Input
            value={emp.endereco_bairro ?? ""}
            onChange={(e) => setEmp({ endereco_bairro: e.target.value })}
          />
        </Field>
        <Field label="Cidade">
          <Input
            value={emp.endereco_cidade ?? ""}
            onChange={(e) => setEmp({ endereco_cidade: e.target.value })}
          />
        </Field>
        <Field label="UF">
          <Input
            value={emp.endereco_estado ?? ""}
            className="uppercase"
            maxLength={2}
            onChange={(e) => setEmp({ endereco_estado: e.target.value.toUpperCase() })}
          />
        </Field>
      </SectionCard>

      <SaveBar busy={busy} disabled={!canSave} onSave={save} />
    </div>
  );
}

// ============ Acesso (administrador) ============
function AcessoPanel() {
  const { user } = useAuth();
  const [nome, setNome] = useState<string>(user?.user_metadata?.nome ?? "");
  const [cpf, setCpf] = useState<string>(user?.user_metadata?.cpf ?? "");
  const [email, setEmail] = useState<string>(user?.email ?? "");
  const [confirmarEmail, setConfirmarEmail] = useState<string>(user?.email ?? "");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => avaliarSenha(senha), [senha]);
  const senhaOk = !senha || strength.score >= 3;
  const confirmaOk = !senha || senha === confirmar;
  const emailOk = !email || isEmail(email);
  const emailMatch = email === confirmarEmail;

  const salvar = async () => {
    if (!emailOk) {
      toast.error("E-mail inválido");
      return;
    }
    if (!emailMatch) {
      toast.error("Os e-mails não coincidem");
      return;
    }
    if (senha && !senhaOk) {
      toast.error("Senha muito fraca");
      return;
    }
    if (senha && !confirmaOk) {
      toast.error("As senhas não coincidem");
      return;
    }

    setBusy(true);
    try {
      const meta: Record<string, unknown> = {};
      if (nome && nome !== user?.user_metadata?.nome) meta.nome = nome;
      if (cpf !== (user?.user_metadata?.cpf ?? "")) meta.cpf = cpf;

      const updates: { email?: string; password?: string; data?: Record<string, unknown> } = {};
      if (email && email !== user?.email) updates.email = email;
      if (senha) updates.password = senha;
      if (Object.keys(meta).length) updates.data = meta;

      if (!Object.keys(updates).length) {
        toast.info("Nada para alterar");
        return;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Dados de acesso atualizados");
      setSenha("");
      setConfirmar("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      icon={KeyRound}
      title="Administrador"
      subtitle="Dados de acesso do administrador do sistema."
    >
      <Field label="Nome do Administrador" required span={2}>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="CPF" hint="Opcional">
        <Input
          value={cpf}
          placeholder="000.000.000-00"
          onChange={(e) => setCpf(maskCPF(e.target.value))}
        />
      </Field>
      <Field label="E-mail de Login" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!emailOk}
        />
        {!emailOk && <p className="text-[11px] text-destructive mt-1">E-mail inválido</p>}
      </Field>
      <Field label="Confirmar E-mail" required>
        <Input
          type="email"
          value={confirmarEmail}
          onChange={(e) => setConfirmarEmail(e.target.value)}
          aria-invalid={!emailMatch}
        />
        {!emailMatch && (
          <p className="text-[11px] text-destructive mt-1">Os e-mails não coincidem</p>
        )}
      </Field>
      <div />
      <Field label="Senha" hint="Mín. 8 caracteres com letras, números e símbolo.">
        <Input
          type="password"
          value={senha}
          placeholder="Deixe em branco para manter"
          onChange={(e) => setSenha(e.target.value)}
        />
        {senha && <StrengthBar score={strength.score} label={strength.label} />}
      </Field>
      <Field label="Confirmar Senha">
        <Input
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          aria-invalid={!confirmaOk}
        />
        {!confirmaOk && (
          <p className="text-[11px] text-destructive mt-1">As senhas não coincidem</p>
        )}
      </Field>

      <div className="md:col-span-2 xl:col-span-3 pt-2 flex justify-end">
        <Button onClick={salvar} disabled={busy} className="min-w-[140px]">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Save className="size-4 mr-2" />
              Salvar
            </>
          )}
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- shared hook & atoms ----------
function useEmpresa() {
  const [emp, setEmpState] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState<Partial<Empresa>>({});

  useEffect(() => {
    (async () => {
      const { data } = await (
        supabase as unknown as { rpc: (fn: string) => Promise<{ data: Empresa[] | null }> }
      ).rpc("get_configuracoes_completo");
      const row = Array.isArray(data) ? data[0] : null;
      setEmpState((row ?? null) as Empresa | null);
      setLoading(false);
    })();
  }, []);

  const setEmp = (patch: Partial<Empresa>) => {
    setEmpState((cur) => (cur ? { ...cur, ...patch } : cur));
    setDirty((d) => ({ ...d, ...patch }));
  };

  const save = async () => {
    if (!emp || Object.keys(dirty).length === 0) {
      toast.info("Nada para salvar");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("configuracoes").update(dirty).eq("id", emp.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cadastro salvo");
    setDirty({});
  };

  return { emp, setEmp, save, busy, loading };
}

function SaveBar({
  busy,
  disabled,
  onSave,
}: {
  busy: boolean;
  disabled?: boolean;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 md:mx-0 px-4 md:px-0 py-3 bg-background/80 backdrop-blur border-t border-border md:border-0 md:bg-transparent md:backdrop-blur-none flex justify-end gap-2">
      <Button onClick={onSave} disabled={busy || disabled} className="min-w-[160px]">
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Save className="size-4 mr-2" />
            Salvar alterações
          </>
        )}
      </Button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid place-items-center py-10">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

function avaliarSenha(s: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (s.length >= 8) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  const label = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"][score];
  return { score: score as 0 | 1 | 2 | 3 | 4, label };
}

function StrengthBar({ score, label }: { score: number; label: string }) {
  const colors = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded ${i < score ? colors[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
        {score >= 3 ? (
          <Check className="size-3 text-success" />
        ) : (
          <X className="size-3 text-destructive" />
        )}
        Força: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}

function LogoSection({
  logoUrl,
  onChange,
}: {
  logoUrl: string | null;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!logoUrl) {
        setPreview(null);
        return;
      }
      if (/^https?:\/\//i.test(logoUrl)) {
        setPreview(logoUrl);
        return;
      }
      const { data } = await supabase.storage.from("logos").createSignedUrl(logoUrl, 60 * 60);
      if (!cancelled) setPreview(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 3 MB)");
      return;
    }
    setBusy(true);
    try {
      const { data: empId, error: eErr } = await (
        supabase as unknown as {
          rpc: (n: string) => Promise<{ data: string | null; error: unknown }>;
        }
      ).rpc("minha_empresa_id");
      if (eErr || !empId) {
        toast.error("Não foi possível identificar a empresa");
        return;
      }
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${empId}/logo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      // Remove logo anterior se existir
      if (logoUrl && !/^https?:\/\//i.test(logoUrl) && logoUrl !== path) {
        await supabase.storage.from("logos").remove([logoUrl]);
      }
      onChange(path);
      toast.success("Logo enviada. Clique em Salvar para confirmar.");
    } finally {
      setBusy(false);
    }
  };

  const remover = async () => {
    if (!logoUrl) return;
    if (!/^https?:\/\//i.test(logoUrl)) {
      await supabase.storage.from("logos").remove([logoUrl]);
    }
    onChange(null);
    toast.success("Logo removida. Clique em Salvar para confirmar.");
  };

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
          <ImageIcon className="size-5" />
        </div>
        <div>
          <h3 className="font-display text-lg leading-tight">Logotipo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aparece no cardápio online e nas telas do sistema. Formato quadrado recomendado.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="size-24 rounded-2xl bg-muted grid place-items-center overflow-hidden border border-border shrink-0">
          {preview ? (
            <img src={preview} alt="Logo" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            {logoUrl ? "Trocar logo" : "Enviar logo"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={remover}
            >
              <Trash2 className="size-4 mr-2" />
              Remover
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">PNG, JPG, WebP ou SVG. Até 3 MB.</p>
        </div>
      </div>
    </Card>
  );
}
