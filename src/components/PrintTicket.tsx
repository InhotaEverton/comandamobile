import { useEffect } from "react";
import { brl } from "@/lib/format";

export type TicketItem = {
  quantidade: number;
  produto_nome: string;
  preco_unit?: number;
  observacao?: string | null;
};
export type TicketKind = "cozinha" | "fechamento";

export interface PrintTicketProps {
  kind: TicketKind;
  mesa?: number | string;
  cliente?: string | null;
  modoMesa?: boolean;
  garcom?: string;
  setor?: string;
  itens: TicketItem[];
  total?: number;
  desconto?: number;
  acrescimo?: number;
  pagamentos?: { forma: string; valor: number; cliente_nome?: string | null }[];
  rodape?: string;
  autoPrint?: boolean;
  onAfterPrint?: () => void;
}

/**
 * Render off-screen and call window.print(). Uses the `.thermal-print` CSS
 * already set up in styles.css for 80mm thermal printers.
 */
export function PrintTicket(props: PrintTicketProps) {
  useEffect(() => {
    if (!props.autoPrint) return;
    const t = setTimeout(() => {
      window.print();
      props.onAfterPrint?.();
    }, 100);
    return () => clearTimeout(t);
  }, [props.autoPrint]);

  const now = new Date();
  const dt = now.toLocaleString("pt-BR");

  return (
    <div className="thermal-print">
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: "14pt" }}>
        {props.kind === "cozinha" ? "PEDIDO COZINHA" : "CUPOM DE FECHAMENTO"}
      </div>
      {props.setor && <div style={{ textAlign: "center" }}>Setor: {props.setor.toUpperCase()}</div>}
      <div>--------------------------------</div>
      {props.modoMesa === false ? (
        <div style={{ fontWeight: 700 }}>Cliente: {props.cliente ?? "—"}</div>
      ) : (
        <div style={{ fontWeight: 700 }}>Mesa {String(props.mesa ?? "-").padStart(2, "0")}</div>
      )}
      {props.garcom && <div>Garçom: {props.garcom}</div>}
      <div>{dt}</div>
      <div>--------------------------------</div>
      {props.itens.map((it, i) => (
        <div key={i} style={{ marginBottom: "2mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>
              {it.quantidade}x {it.produto_nome}
            </span>
            {it.preco_unit != null && <span>{brl(it.preco_unit * it.quantidade)}</span>}
          </div>
          {it.observacao && <div style={{ fontStyle: "italic" }}> &gt; {it.observacao}</div>}
        </div>
      ))}
      {props.kind === "fechamento" && (
        <>
          <div>--------------------------------</div>
          {props.acrescimo ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Acréscimo</span>
              <span>{brl(props.acrescimo)}</span>
            </div>
          ) : null}
          {props.desconto ? (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Desconto</span>
              <span>- {brl(props.desconto)}</span>
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: "13pt",
            }}
          >
            <span>TOTAL</span>
            <span>{brl(props.total ?? 0)}</span>
          </div>
          {props.pagamentos && props.pagamentos.length > 0 && (
            <>
              <div>--------------------------------</div>
              <div style={{ fontWeight: 700 }}>Pagamentos:</div>
              {props.pagamentos.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>
                    {p.forma.toUpperCase()}
                    {p.cliente_nome ? ` · ${p.cliente_nome}` : ""}
                  </span>
                  <span>{brl(p.valor)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
      <div>--------------------------------</div>
      <div style={{ textAlign: "center" }}>{props.rodape ?? "Obrigado pela preferência!"}</div>
    </div>
  );
}

/** Imperative helper: open a hidden window and print a ticket without
 *  mutating the main page (useful for "reimprimir"). */
export function printTicketWindow(html: string) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Imprimir</title>
    <style>
      @page { size: 80mm auto; margin: 2mm; }
      body { margin: 0; width: 76mm; color: #000; background: #fff;
        font-family: 'Courier New', monospace; font-size: 11pt; line-height: 1.3; }
    </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 200);
}
