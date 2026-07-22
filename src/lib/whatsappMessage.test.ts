import { describe, expect, it } from "vitest";
import { criarWhatsAppUrl, mensagemStatusClienteWhatsApp } from "./whatsappMessage";

const comanda = {
  id: "comanda-1",
  total: 22,
  cliente_nome: "Laiane á é í ó ú ã õ ç",
};

const itens = [
  {
    id: "item-1",
    comanda_id: "comanda-1",
    produto_nome: "Crepe á é í ó ú ã õ ç",
    quantidade: 1,
    observacao: "sem cebola 😊",
  },
];

const adicionais = [
  { item_pedido_id: "item-1", adicional_nome: "Frango", grupo_nome: "Recheio", quantidade: 1 },
  { item_pedido_id: "item-1", adicional_nome: "Cheddar", grupo_nome: "Queijo", quantidade: 1 },
  {
    item_pedido_id: "item-1",
    adicional_nome: "Molho de Tomate",
    grupo_nome: "Molho",
    quantidade: 1,
  },
];

function textFromUrl(url: string): string {
  const parsed = new URL(url);
  const encodedText = parsed.search.match(/[?&]text=([^&]*)/)?.[1] ?? "";
  return decodeURIComponent(encodedText.replace(/\+/g, "%20"));
}

describe("mensagem de WhatsApp do pedido online", () => {
  it("gera a mensagem em UTF-8 com acentos, emojis e sem caracteres inválidos", () => {
    const message = mensagemStatusClienteWhatsApp({
      comanda,
      itens,
      adicionais,
      nomeEmpresa: "A Creperia 🎉",
    });

    expect(message).toContain("🍽️ *A Creperia 🎉*");
    expect(message).toContain("Olá, *Laiane*! 👋");
    expect(message).toContain("Crepe á é í ó ú ã õ ç");
    expect(message).toContain("🧾 *Resumo do pedido*");
    expect(message).toContain("  • Frango");
    expect(message).toContain("  • Cheddar");
    expect(message).toContain("  • Molho de Tomate");
    expect(message).toContain("📍 Estamos aguardando sua visita.");
    expect(message).toContain("Obrigado pela preferência! ❤️");
    expect(message).not.toContain("�");
    expect(message).toBe(message.normalize("NFC"));
  });

  it("mantém todos os delimitadores de negrito balanceados", () => {
    const message = mensagemStatusClienteWhatsApp({
      comanda,
      itens,
      adicionais,
      nomeEmpresa: "A *Creperia* _Oficial_",
    });

    expect(message).toContain("🍽️ *A Creperia Oficial*");
    expect((message.match(/\*/g) ?? []).length % 2).toBe(0);
    expect(message).toMatch(/\*A Creperia Oficial\*/);
    expect(message).toMatch(/\*Laiane\*/);
    expect(message).toMatch(/\*Seu pedido está pronto para retirada\.\*/);
    expect(message).toMatch(/\*Resumo do pedido\*/);
    expect(message).toMatch(/\*Total:\*/);
    expect(message).not.toContain("**");
  });

  it("codifica a URL uma única vez e decodifica de volta para a mesma mensagem", () => {
    const message = mensagemStatusClienteWhatsApp({
      comanda,
      itens,
      adicionais,
      nomeEmpresa: "A Creperia 🍽️❤️🎉📍🧾👋😊",
    });
    const url = criarWhatsAppUrl("(11) 99999-8888", message);
    const decoded = textFromUrl(url);

    expect(url).toContain("phone=5511999998888");
    expect(decoded).toBe(message);
    expect(decoded).toContain("🍽️❤️🎉📍🧾👋😊");
    expect(decoded).toContain("Crepe á é í ó ú ã õ ç");
    expect(decoded).not.toContain("%F0");
    expect(decoded).not.toContain("�");
  });

  it("preserva os caracteres exigidos em um round-trip real de encodeURIComponent", () => {
    const sample = "á é í ó ú ã õ ç 🍽️❤️🎉📍🧾👋😊";
    const decoded = decodeURIComponent(encodeURIComponent(sample.normalize("NFC")));

    expect(decoded).toBe(sample.normalize("NFC"));
    expect(decoded).not.toContain("�");
  });
});
