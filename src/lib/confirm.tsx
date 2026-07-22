import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Options = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** Se informado, o usuário precisa digitar exatamente esta palavra para liberar o botão. */
  requireTyping?: string;
};

type State = Required<Omit<Options, "destructive" | "requireTyping">> & {
  destructive: boolean;
  requireTyping: string | null;
  open: boolean;
  resolve?: (v: boolean) => void;
};

const DEFAULT: State = {
  open: false,
  title: "Confirmar exclusão",
  description: "Tem certeza que deseja excluir este registro? Esta ação não poderá ser desfeita.",
  confirmText: "Excluir",
  cancelText: "Cancelar",
  destructive: true,
  requireTyping: null,
};

let setter: ((s: State) => void) | null = null;
let current: State = DEFAULT;

export function confirmDialog(opts: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const next: State = {
      ...DEFAULT,
      ...opts,
      destructive: opts.destructive ?? true,
      requireTyping: opts.requireTyping ?? null,
      open: true,
      resolve,
    };
    current = next;
    setter?.(next);
  });
}

/** Atalho para exclusão com digitação obrigatória. */
export function confirmDelete(name?: string): Promise<boolean> {
  return confirmDialog({
    title: name ? `Excluir "${name}"?` : "Confirmar exclusão",
    description: "Esta ação é permanente e não poderá ser desfeita.",
    requireTyping: "EXCLUIR",
    confirmText: "Excluir",
    destructive: true,
  });
}

export function ConfirmProvider() {
  const [state, setState] = useState<State>(current);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    setter = setState;
    return () => {
      setter = null;
    };
  }, []);
  useEffect(() => {
    if (state.open) setTyped("");
  }, [state.open]);
  const close = (result: boolean) => {
    state.resolve?.(result);
    const next = { ...state, open: false, resolve: undefined };
    current = next;
    setState(next);
  };
  const needsTyping = !!state.requireTyping;
  const canConfirm =
    !needsTyping || typed.trim().toUpperCase() === state.requireTyping!.toUpperCase();
  return (
    <AlertDialog
      open={state.open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          <AlertDialogDescription>{state.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsTyping && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Para confirmar, digite{" "}
              <span className="font-bold text-destructive">{state.requireTyping}</span> abaixo
            </Label>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={state.requireTyping ?? ""}
              className="h-11 font-mono uppercase tracking-wider"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>{state.cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => canConfirm && close(true)}
            disabled={!canConfirm}
            className={
              state.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                : "disabled:opacity-50"
            }
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Maps Postgres errors to a friendly message and shows a toast. Returns true if an error was handled. */
export function handleDeleteError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (
    error.code === "23503" ||
    /foreign key|violates|is still referenced/i.test(error.message ?? "")
  ) {
    toast.error(
      "Não é possível excluir este registro porque ele está sendo utilizado pelo sistema.",
    );
  } else {
    toast.error(error.message ?? "Erro ao excluir");
  }
  return true;
}
