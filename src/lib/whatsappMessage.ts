import { brl } from "@/lib/format";

export type WhatsAppComanda = {
  id: string;
  total: number | string;
  cliente_nome: string | null;
};

export type WhatsAppItem = {
  id: string;
  comanda_id: string;
  produto_nome: string;
  quantidade: number | string;
  observacao: string | null;
};

export type WhatsAppAdicional = {
  item_pedido_id: string;
  adicional_nome: string;
  grupo_nome: string | null;
  quantidade: number | string;
};

export function limparTextoWhatsApp(valor: string): string {
  return valor
    .normalize("NFC")
    .replace(/\p{Cc}/gu, " ")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function primeiroNomeWhatsApp(nome: string | null): string {
  return limparTextoWhatsApp(nome || "cliente").split(/\s+/)[0] || "cliente";
}

export function montarListaItensWhatsApp(
  comanda: Pick<WhatsAppComanda, "id">,
  itens: WhatsAppItem[],
  adicionais: WhatsAppAdicional[],
): string {
  const itensDaComanda = itens.filter((i) => i.comanda_id === comanda.id);
  const agrupados = new Map<
    string,
    { item: WhatsAppItem; quantidade: number; adicionais: WhatsAppAdicional[] }
  >();

  itensDaComanda.forEach((item) => {
    const adicionaisDoItem = adicionais
      .filter((a) => a.item_pedido_id === item.id)
      .sort((a, b) =>
        `${a.grupo_nome ?? ""}${a.adicional_nome}`.localeCompare(
          `${b.grupo_nome ?? ""}${b.adicional_nome}`,
        ),
      );
    const assinaturaAdicionais = adicionaisDoItem
      .map((a) => `${a.grupo_nome ?? "Adicionais"}:${a.adicional_nome}:${a.quantidade}`)
      .join("|");
    const assinatura = [item.produto_nome, item.observacao ?? "", assinaturaAdicionais].join("::");
    const atual = agrupados.get(assinatura);
    if (atual) {
      atual.quantidade += Number(item.quantidade);
    } else {
      agrupados.set(assinatura, {
        item,
        quantidade: Number(item.quantidade),
        adicionais: adicionaisDoItem,
      });
    }
  });

  return Array.from(agrupados.values())
    .map(({ item, quantidade, adicionais: adicionaisDoItem }) => {
      const linhas = [`• ${quantidade}x ${limparTextoWhatsApp(item.produto_nome)}`];
      adicionaisDoItem.forEach((adicional) => {
        const qtd = Number(adicional.quantidade) > 1 ? `${adicional.quantidade}x ` : "";
        linhas.push(`  • ${qtd}${limparTextoWhatsApp(adicional.adicional_nome)}`);
      });
      if (item.observacao) linhas.push(`  • Obs.: ${limparTextoWhatsApp(item.observacao)}`);
      return linhas.join("\n");
    })
    .join("\n\n");
}

export type StatusWhatsApp =
  "recebido" | "aceito" | "preparo" | "pronto" | "finalizado" | "cancelado";
export type TipoEntregaWhatsApp = "entrega" | "retirada" | "local";

function copyStatus(
  status: StatusWhatsApp,
  tipo: TipoEntregaWhatsApp,
): { linha: string; rodape: string } {
  const isEntrega = tipo === "entrega";
  switch (status) {
    case "recebido":
      return {
        linha: "Recebemos seu pedido e já vamos analisar. ✅",
        rodape: "Em instantes confirmamos com você.",
      };
    case "aceito":
      return {
        linha: "Seu pedido foi *CONFIRMADO*. 👍",
        rodape: isEntrega
          ? "Já vamos preparar e enviar para entrega."
          : "Já vamos começar o preparo para retirada.",
      };
    case "preparo":
      return {
        linha: "Seu pedido está *EM PREPARO*. 👨‍🍳",
        rodape: isEntrega
          ? "Assim que sair para entrega avisamos."
          : "Assim que estiver pronto para retirada avisamos.",
      };
    case "pronto":
      return isEntrega
        ? {
            linha: "🛵 *Seu pedido está saindo para entrega.*",
            rodape: "⏰ Tempo estimado: 20 a 30 minutos.",
          }
        : {
            linha: "🛍️ *Seu pedido está pronto para retirada.*",
            rodape: "📍 Estamos aguardando sua visita.",
          };
    case "finalizado":
      return isEntrega
        ? { linha: "✅ Seu pedido foi *entregue*.", rodape: "Esperamos que aproveite!" }
        : { linha: "✅ Seu pedido foi *finalizado*.", rodape: "Esperamos ver você em breve!" };
    case "cancelado":
      return {
        linha: "Infelizmente seu pedido foi *CANCELADO*. 😔",
        rodape: "Se tiver dúvidas, fale com a gente.",
      };
  }
}

export function mensagemStatusClienteWhatsApp({
  comanda,
  itens,
  adicionais,
  nomeEmpresa,
  status = "pronto",
  tipoEntrega = "retirada",
}: {
  comanda: WhatsAppComanda;
  itens: WhatsAppItem[];
  adicionais: WhatsAppAdicional[];
  nomeEmpresa: string | null | undefined;
  status?: StatusWhatsApp;
  tipoEntrega?: TipoEntregaWhatsApp;
}): string {
  const primeiro = primeiroNomeWhatsApp(comanda.cliente_nome);
  const nomeEmp = limparTextoWhatsApp(nomeEmpresa ?? "") || "Nosso estabelecimento";
  const resumoItens = montarListaItensWhatsApp(comanda, itens, adicionais) || "—";
  const total = brl(Number(comanda.total));
  const copy = copyStatus(status, tipoEntrega);

  return [
    `🍽️ *${nomeEmp}*`,
    "",
    `Olá, *${primeiro}*! 👋`,
    "",
    copy.linha,
    "",
    "🧾 *Resumo do pedido*",
    "",
    resumoItens,
    "",
    `💰 *Total:* ${total}`,
    "",
    copy.rodape,
    "",
    "Obrigado pela preferência! ❤️",
  ]
    .join("\n")
    .normalize("NFC");
}

export function criarWhatsAppUrl(telefone: string, message: string): string {
  const digits = telefone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const utf8Message = message.normalize("NFC");
  return `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(utf8Message)}`;
}
