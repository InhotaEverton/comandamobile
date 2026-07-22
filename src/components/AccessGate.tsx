import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConfig } from "@/hooks/useConfig";
import { useAuth } from "@/lib/auth";
import { estaAberto, hojeISO, DIA_LABEL } from "@/lib/horario";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Clock, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  isAdmin?: boolean;
  children: React.ReactNode;
};

const LS_PIN = (uid: string) => `pin_ok_${uid}_${hojeISO()}`;

export function AccessGate({ isAdmin: isAdminProp, children }: Props) {
  const cfg = useConfig();
  const { roles } = useAuth();
  const bypass = !!isAdminProp || roles.includes("admin") || roles.includes("caixa");
  const [uid, setUid] = useState<string | null>(null);
  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUid(id);
      if (id && typeof window !== "undefined") {
        setPinOk(localStorage.getItem(LS_PIN(id)) === "1");
      }
    });
  }, []);

  if (!cfg) return <>{children}</>;

  // Admins/caixa contornam gate
  if (bypass) return <>{children}</>;

  // 1) Horário
  if (cfg.horario_ativo) {
    const { aberto, dia, nome } = estaAberto(cfg.horarios);
    if (!aberto) {
      return (
        <div className="min-h-[60vh] grid place-items-center p-6">
          <Card className="max-w-md w-full p-6 text-center">
            <Clock className="size-10 text-warning mx-auto mb-3" />
            <h2 className="font-display text-2xl mb-1">Estabelecimento fechado</h2>
            <p className="text-sm text-muted-foreground">
              Hoje ({DIA_LABEL[nome]}) o atendimento{" "}
              {dia.aberto ? `é das ${dia.abre} às ${dia.fecha}` : "está desativado"}.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Procure o administrador caso precise operar fora do horário.
            </p>
          </Card>
        </div>
      );
    }
  }

  // 2) PIN do dia
  if (cfg.pin_diario_ativo && !pinOk) {
    const validar = async () => {
      const v = pinInput.trim();
      if (!v) return;
      setBusy(true);
      const { data, error } = await supabase.rpc("validar_pin_hoje", { _pin: v });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) {
        toast.error("PIN incorreto ou não cadastrado para hoje");
        return;
      }
      if (uid) localStorage.setItem(LS_PIN(uid), "1");
      setPinOk(true);
      toast.success("Acesso liberado");
    };
    return (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <Card className="max-w-sm w-full p-6">
          <div className="text-center mb-4">
            <KeyRound className="size-10 text-primary mx-auto mb-2" />
            <h2 className="font-display text-2xl">PIN diário</h2>
            <p className="text-sm text-muted-foreground">
              Informe o código fornecido pelo administrador.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pin">Código</Label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void validar();
                }}
                className="h-12 text-center text-2xl tracking-[0.4em]"
                maxLength={10}
              />
            </div>
            <Button onClick={validar} disabled={busy} className="w-full h-12">
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}Validar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
