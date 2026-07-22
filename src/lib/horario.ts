import type { HorariosSemana, HorarioDia } from "@/hooks/useConfig";

const DIAS: (keyof HorariosSemana)[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
export const DIA_LABEL: Record<keyof HorariosSemana, string> = {
  dom: "Domingo",
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
};
export const DIAS_ORDEM = DIAS;

function toMin(t: string) {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function estaAberto(
  horarios: HorariosSemana,
  agora: Date = new Date(),
): { aberto: boolean; dia: HorarioDia; nome: keyof HorariosSemana } {
  const nome = DIAS[agora.getDay()];
  const dia = horarios[nome];
  if (!dia || !dia.aberto)
    return { aberto: false, dia: dia ?? { abre: "00:00", fecha: "00:00", aberto: false }, nome };
  const m = agora.getHours() * 60 + agora.getMinutes();
  const ini = toMin(dia.abre);
  const fim = toMin(dia.fecha);
  // Se fecha <= abre considera virada (ex: 18:00 -> 02:00). Aqui simples: dentro do dia.
  const aberto = fim > ini ? m >= ini && m <= fim : m >= ini || m <= fim;
  return { aberto, dia, nome };
}

export function hojeISO(d: Date = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
