import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — Comanda Mobile" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { session, loading, signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres");
      return;
    }
    setBusy(true);
    try {
      const { error } = await signUp({ email, password, nome, nomeEmpresa });
      if (error) {
        toast.error(error);
        return;
      }
      // Auto-login (caso confirmação esteja desativada)
      const { error: signinErr } = await signIn(email, password);
      if (signinErr) {
        toast.success("Conta criada. Faça login para continuar.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Empresa criada com sucesso!");
      navigate({ to: "/admin", search: { tab: "dashboard" }, replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,oklch(0.58_0.21_27/0.18),transparent_60%)] pointer-events-none" />
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-3 z-10">
        <div className="size-10 rounded-xl bg-primary grid place-items-center glow-red">
          <ChefHat className="size-5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl tracking-wider">
          COMANDA MOBILE<span className="text-primary">.</span>
        </span>
      </Link>
      <Card className="relative w-full max-w-md p-8 bg-card border-border">
        <h2 className="font-display text-3xl text-center">Criar nova empresa</h2>
        <p className="text-sm text-muted-foreground mt-1 text-center">
          Só o essencial agora — você configura o restante depois.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
            <Input
              id="nomeEmpresa"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              required
              maxLength={120}
              placeholder="Restaurante do João"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nome">Seu nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={120}
              placeholder="João Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@restaurante.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy} className="w-full h-11 text-base">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Criar empresa e entrar
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
