import { useEffect, useState } from "react";
import { confirmDelete } from "@/lib/confirm";

import { useServerFn } from "@tanstack/react-start";
import {
  criarMembroEquipe,
  atualizarMembroEquipe,
  excluirMembroEquipe,
  listarMembrosEquipe,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Membro = Awaited<ReturnType<typeof listarMembrosEquipe>>[number];
type Role = "admin" | "garcom" | "caixa";

export function EquipeTab() {
  const list = useServerFn(listarMembrosEquipe);
  const create = useServerFn(criarMembroEquipe);
  const update = useServerFn(atualizarMembroEquipe);
  const remove = useServerFn(excluirMembroEquipe);

  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    role: "garcom" as Role,
  });
  const [editing, setEditing] = useState<Membro | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await list();
      setMembros(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.nome || !form.email || !form.senha) {
      toast.error("Preencha nome, e-mail e senha");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
          senha: form.senha,
          role: form.role,
        },
      });
      toast.success("Membro criado");
      setOpen(false);
      setForm({ nome: "", email: "", telefone: "", senha: "", role: "garcom" });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAtivo = async (m: Membro) => {
    try {
      await update({ data: { userId: m.id, ativo: !m.ativo } });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const salvarEdicao = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await update({
        data: {
          userId: editing.id,
          nome: editing.nome,
          telefone: editing.telefone,
          role: (editing.roles[0] ?? "garcom") as Role,
          novaSenha: novaSenha || undefined,
        },
      });
      toast.success("Atualizado");
      setEditing(null);
      setNovaSenha("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{membros.length} membro(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="size-4 mr-1" />
              Novo membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo membro da equipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Senha</Label>
                  <Input
                    type="text"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    placeholder="mín. 6 caracteres"
                  />
                </div>
                <div>
                  <Label>Função</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as Role })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="garcom">Garçom</SelectItem>
                      <SelectItem value="caixa">Caixa</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin mr-2" />}Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {membros.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  {m.telefone && <p className="text-xs text-muted-foreground">{m.telefone}</p>}
                </div>
                <Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m)} />
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {m.roles.map((r) => (
                  <Badge key={r} variant="outline" className="capitalize">
                    {r}
                  </Badge>
                ))}
                {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditing(m);
                    setNovaSenha("");
                  }}
                >
                  <Pencil className="size-3.5 mr-1" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={async () => {
                    if (!(await confirmDelete(m.nome))) return;
                    try {
                      await remove({ data: { userId: m.id } });
                      toast.success("Membro excluído");
                      load();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Trash2 className="size-3.5 mr-1" />
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar membro</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editing.nome}
                    onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={editing.telefone ?? ""}
                    onChange={(e) => setEditing({ ...editing, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Função</Label>
                  <Select
                    value={editing.roles[0] ?? "garcom"}
                    onValueChange={(v) => setEditing({ ...editing, roles: [v] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="garcom">Garçom</SelectItem>
                      <SelectItem value="caixa">Caixa</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nova senha (opcional)</Label>
                  <Input
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Manter atual"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={salvarEdicao} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
