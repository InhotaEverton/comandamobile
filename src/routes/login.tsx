import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  ChefHat,
  Loader2,
  ClipboardList,
  Timer,
  Printer,
  Users,
  LayoutDashboard,
  BarChart3,
  Building2,
  Monitor,
  Smartphone,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Comanda Mobile" }] }),
  component: LoginPage,
});

const benefits = [
  { icon: ClipboardList, text: "Gestão completa de comandas" },
  { icon: Timer, text: "Pedidos em tempo real" },
  { icon: Printer, text: "Impressão" },
  { icon: Users, text: "Controle de garçons" },
  { icon: LayoutDashboard, text: "Dashboard gerencial" },
  { icon: BarChart3, text: "Relatórios e indicadores" },
  { icon: Building2, text: "Multiempresa" },
  { icon: Monitor, text: "Acesso via computador, tablet e celular" },
];

function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await signIn(email, password);
      if (error) toast.error(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100svh] flex flex-col lg:flex-row bg-background relative overflow-x-hidden">
      {/* decorative glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.58_0.21_27/0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,oklch(0.58_0.21_27/0.08),transparent_50%)] pointer-events-none" />

      {/* Lado Esquerdo — Institucional (mobile: aparece depois do login) */}
      <div className="relative z-10 flex flex-col justify-center px-6 py-8 lg:py-12 lg:w-1/2 lg:px-16 xl:px-24 order-2 lg:order-1">
        <Link to="/" className="hidden lg:flex items-center gap-3 mb-8">
          <div className="size-12 rounded-xl bg-primary grid place-items-center glow-red">
            <ChefHat className="size-6 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl tracking-wider">
            COMANDA MOBILE<span className="text-primary">.</span>
          </span>
        </Link>

        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl xl:text-5xl leading-tight">
          Transforme seu atendimento com <span className="text-primary">rapidez</span>,{" "}
          <span className="text-primary">organização</span> e{" "}
          <span className="text-primary">controle</span>.
        </h1>

        <p className="mt-4 text-muted-foreground text-sm lg:text-base max-w-md leading-relaxed">
          Sistema completo para gestão de comandas, pedidos, vendas e operação em tempo real para
          restaurantes, bares, lanchonetes e estabelecimentos do ramo alimentício.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5">
              <div className="shrink-0 size-6 rounded-full bg-primary/10 grid place-items-center">
                <Check className="size-3.5 text-primary" />
              </div>
              <span className="text-sm text-foreground/90">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lado Direito — Login (mobile: aparece primeiro, ocupa a primeira tela) */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-6 pb-8 lg:py-12 lg:w-1/2 min-h-[100svh] lg:min-h-screen order-1 lg:order-2">
        {/* Logo + nome (mobile only) */}
        <Link to="/" className="flex lg:hidden items-center gap-2.5 mb-4">
          <div className="size-10 rounded-xl bg-primary grid place-items-center glow-red">
            <ChefHat className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl tracking-wider">
            COMANDA MOBILE<span className="text-primary">.</span>
          </span>
        </Link>

        {/* Frase principal (mobile only) */}
        <p className="lg:hidden text-center text-sm text-muted-foreground max-w-xs mb-5 px-2">
          Transforme seu atendimento com <span className="text-primary font-medium">rapidez</span>,{" "}
          <span className="text-primary font-medium">organização</span> e{" "}
          <span className="text-primary font-medium">controle</span>.
        </p>

        <Card className="w-full max-w-sm p-6 sm:p-8 bg-card/80 backdrop-blur-sm border-border">
          <h2 className="font-display text-2xl sm:text-3xl text-center">ENTRAR</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Acesse sua conta para continuar.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11 text-base">
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center text-sm">
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </div>
        </Card>
      </div>

      {/* Rodapé */}
      <div className="lg:absolute lg:bottom-4 lg:left-0 lg:right-0 z-10 text-center text-xs text-muted-foreground px-6 py-4 order-3">
        © Comanda Mobile
      </div>
    </div>
  );
}
