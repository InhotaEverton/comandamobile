import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addNovos, beep, clearNovos, getNovos, onNovosChange } from "@/lib/pedidosNotify";
import {
  Loader2,
  ChefHat,
  LogOut,
  LayoutDashboard,
  UtensilsCrossed,
  Wallet,
  Globe as GlobeIcon,
  Package,
  Tags,
  Sparkles,
  Settings2,
  Users,
  KeyRound,
  Globe,
  Clock,
  Bike,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TabKey } from "@/routes/_authenticated/admin";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  tab?: TabKey;
  show: boolean;
};

function AuthLayout() {
  const { loading, session, roles, nome, signOut, empresa } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [novos, setNovos] = useState(0);
  const lastIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    setNovos(getNovos());
    return onNovosChange(() => setNovos(getNovos()));
  }, []);
  useEffect(() => {
    if (path === "/pedidos-online") {
      clearNovos();
      lastIdsRef.current = null;
    }
  }, [path]);

  useEffect(() => {
    if (!session || !empresa?.id) return;
    let alive = true;
    const check = async () => {
      const { data } = await supabase
        .from("comandas")
        .select("id")
        .eq("empresa_id", empresa.id)
        .eq("origem", "online")
        .eq("status_online", "novo");
      if (!alive) return;
      const ids = new Set((data ?? []).map((r: { id: string }) => r.id));
      const prev = lastIdsRef.current;
      if (prev) {
        const diff = [...ids].filter((id) => !prev.has(id));
        if (diff.length && path !== "/pedidos-online") {
          addNovos(diff.length);
          beep();
        }
      }
      lastIdsRef.current = ids;
    };
    check();
    const t = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [session, empresa?.id, path]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;

  const isAdmin = roles.includes("admin");
  const isCaixa = roles.includes("caixa");
  const isCozinha = roles.includes("cozinha");
  const isGarcom = roles.includes("garcom");
  const canAdmin = isAdmin || isCaixa;

  // Menu único e enxuto — mobile first, focado em velocidade de operação.
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Operação",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          to: "/admin",
          tab: "dashboard",
          show: canAdmin,
        },
        {
          label: "Comandas",
          icon: UtensilsCrossed,
          to: "/pedidos",
          show: isGarcom || canAdmin || isCozinha,
        },
        {
          label: "Pedidos Online",
          icon: GlobeIcon,
          to: "/pedidos-online",
          show: isGarcom || canAdmin || isCozinha,
        },
        { label: "Caixa", icon: Wallet, to: "/admin", tab: "caixa", show: canAdmin },
        { label: "Relatórios", icon: BarChart3, to: "/relatorios", show: canAdmin },
      ],
    },

    {
      label: "Cadastros",
      items: [
        { label: "Produtos", icon: Package, to: "/admin", tab: "produtos", show: isAdmin },
        { label: "Categorias", icon: Tags, to: "/admin", tab: "categorias", show: isAdmin },
        { label: "Adicionais", icon: Sparkles, to: "/admin", tab: "adicionais", show: isAdmin },
      ],
    },
    {
      label: "Sistema",
      items: [
        { label: "Usuários", icon: Users, to: "/admin", tab: "equipe", show: isAdmin },
        { label: "PIN Diário", icon: KeyRound, to: "/admin", tab: "pin", show: isAdmin },
        { label: "Pedido Online", icon: Globe, to: "/admin", tab: "online", show: isAdmin },
        { label: "Delivery & Retirada", icon: Bike, to: "/admin", tab: "delivery", show: isAdmin },
        { label: "Horário & Operação", icon: Clock, to: "/admin", tab: "operacao", show: isAdmin },
        { label: "Configurações", icon: Settings2, to: "/admin", tab: "config", show: isAdmin },
      ],
    },
  ];

  const iniciais = (nome ?? session.user?.email ?? "?")
    .split(/[ @]/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SidebarProvider>
      <div className="h-dvh w-full flex overflow-hidden bg-background">
        <AppSidebar
          groups={groups}
          nome={nome ?? session.user?.email ?? ""}
          iniciais={iniciais}
          signOut={signOut}
          novosOnline={novos}
        />
        <SidebarInset className="flex flex-col min-w-0 min-h-0 h-full">
          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-3 sm:px-5 border-b border-border bg-background/80 backdrop-blur">
            <SidebarTrigger />
            <Link to="/" className="flex items-center gap-2 md:hidden">
              <div className="size-8 rounded-lg bg-primary grid place-items-center">
                <ChefHat className="size-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg tracking-wider">
                COMANDA MOBILE<span className="text-primary">.</span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-secondary/60">
                <div className="size-7 rounded-full bg-primary/15 text-primary text-xs font-semibold grid place-items-center">
                  {iniciais}
                </div>
                <span className="text-sm text-foreground/90 max-w-[160px] truncate">{nome}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={signOut} aria-label="Sair">
                <LogOut className="size-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({
  groups,
  nome,
  iniciais,
  signOut,
  novosOnline,
}: {
  groups: { label: string; items: NavItem[] }[];
  nome: string;
  iniciais: string;
  signOut: () => void;
  novosOnline: number;
}) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as { tab?: string } });
  const activeTab = search?.tab;

  const isActive = (item: NavItem) => {
    if (item.tab) {
      if (path !== "/admin") return false;
      if (item.tab === "dashboard") return !activeTab || activeTab === "dashboard";
      return activeTab === item.tab;
    }
    return path === item.to || path.startsWith(item.to + "/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <div className="size-8 rounded-lg bg-primary grid place-items-center shrink-0">
            <ChefHat className="size-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg tracking-wider truncate">
              COMANDA MOBILE<span className="text-primary">.</span>
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => {
          const items = g.items.filter((i) => i.show);
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isActive(item);
                    const isPedidosOnline = item.to === "/pedidos-online" && !item.tab;
                    const showBadge = isPedidosOnline && novosOnline > 0;
                    return (
                      <SidebarMenuItem key={`${item.to}-${item.tab ?? ""}-${item.label}`}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link
                            to={item.to}
                            search={item.tab ? { tab: item.tab } : undefined}
                            onClick={closeOnMobile}
                            className={`flex items-center gap-2 ${showBadge ? "animate-pulse text-primary" : ""}`}
                          >
                            <item.icon className="size-4" />
                            <span className="flex-1">{item.label}</span>
                            {showBadge && (
                              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                                {novosOnline}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/60 mb-1">
            <div className="size-8 rounded-full bg-primary/15 text-primary text-xs font-semibold grid place-items-center shrink-0">
              {iniciais}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{nome}</p>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                closeOnMobile();
                signOut();
              }}
              tooltip="Sair"
            >
              <LogOut className="size-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
