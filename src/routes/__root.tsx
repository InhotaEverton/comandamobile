import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { type ReactNode } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/lib/confirm";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Comanda Digital — Sistema para Restaurante" },
      {
        name: "description",
        content:
          "Sistema de comandas digitais para restaurantes. Pedidos em tempo real, gestão de mesas, cozinha e caixa.",
      },
      { name: "theme-color", content: "#d62828" },
      { name: "msapplication-TileColor", content: "#111111" },
      { name: "msapplication-config", content: "/browserconfig.xml" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Comanda" },
      { name: "application-name", content: "Comanda Mobile" },
      { property: "og:title", content: "Comanda Digital — Sistema para Restaurante" },
      { name: "twitter:title", content: "Comanda Digital — Sistema para Restaurante" },
      {
        property: "og:description",
        content:
          "Sistema de comandas digitais para restaurantes. Pedidos em tempo real, gestão de mesas, cozinha e caixa.",
      },
      {
        name: "twitter:description",
        content:
          "Sistema de comandas digitais para restaurantes. Pedidos em tempo real, gestão de mesas, cozinha e caixa.",
      },
      { property: "og:image", content: "/android-chrome-512x512.png" },
      { name: "twitter:image", content: "/android-chrome-512x512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-display text-gradient-red">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <a
          href="/"
          className="mt-6 inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md"
        >
          Voltar
        </a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-display">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <a
          href="/"
          className="mt-6 inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md"
        >
          Início
        </a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors theme="dark" position="top-right" />
        <ConfirmProvider />
      </AuthProvider>
    </QueryClientProvider>
  );
}
