export type ViaCepEndereco = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export async function buscarCep(cep: string): Promise<ViaCepEndereco | null> {
  const clean = (cep ?? "").replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!r.ok) return null;
    const j = (await r.json()) as ViaCepEndereco;
    if (j.erro) return null;
    return j;
  } catch {
    return null;
  }
}

export function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
