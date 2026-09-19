// Datas sem hora, e a idade que sai delas.
//
// Nascimento, data de graduação e emissão de RG são `@db.Date`: dia civil, sem
// hora e sem fuso. O modo clássico de errar isso é deixar o JavaScript aplicar
// o fuso do servidor — `new Date("2010-05-03")` é meia-noite UTC, mas
// `new Date(2010, 4, 3)` é meia-noite local e, num servidor em UTC, vira
// 2010-05-03T03:00Z, que ainda é dia 3; já em UTC+X vira dia 2. O erro é de um
// dia, aparece só em parte dos casos e ninguém percebe.
//
// A saída deste arquivo: dia civil é a string `AAAA-MM-DD`, e Date só existe na
// fronteira com o Prisma, sempre em meia-noite UTC.

/**
 * Amapá. O servidor roda em UTC na Vercel, então "hoje" precisa ser calculado
 * no fuso de quem usa o app — senão, entre 21h e a meia-noite local, o sistema
 * já está no dia seguinte e um aniversário é contado um dia antes.
 */
export const FUSO_PROJETO = "America/Belem";

// en-CA formata como AAAA-MM-DD, que é exatamente o formato ISO de dia civil.
const FORMATADOR_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_PROJETO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** O dia de hoje no fuso do projeto, como `AAAA-MM-DD`. */
export function hojeNoProjeto(agora: Date = new Date()): string {
  return FORMATADOR_ISO.format(agora);
}

/**
 * Valida `AAAA-MM-DD` de verdade, não só o formato: 2025-02-30 casa com a
 * expressão regular e não existe no calendário.
 */
export function ehDiaValido(iso: string): boolean {
  if (!FORMATO_ISO.test(iso)) return false;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

/** `AAAA-MM-DD` para o Date de meia-noite UTC que o Prisma grava em `@db.Date`. */
export function diaParaData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * O caminho de volta. Lê as partes em UTC porque foi em UTC que o valor entrou:
 * `getDate()` aqui devolveria o dia anterior em qualquer fuso a oeste.
 */
export function dataParaDia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** `AAAA-MM-DD` para `DD/MM/AAAA`, que é como a tela mostra. */
export function formatarDiaBr(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const iso = typeof valor === "string" ? valor : dataParaDia(valor);
  if (!ehDiaValido(iso)) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Idade em anos completos.
 *
 * Comparação de partes, não subtração de milissegundos: com milissegundos o
 * horário de verão e os anos bissextos deslocam o resultado perto do
 * aniversário, e é justamente perto do aniversário que esta função decide
 * coisas — os cortes de 12 e de 16 anos.
 *
 * 11 anos, 11 meses e 29 dias devolve 11. No dia do aniversário, 12.
 */
export function idadeEm(nascimentoIso: string, refIso: string): number {
  const [anoN, mesN, diaN] = nascimentoIso.split("-").map(Number);
  const [anoR, mesR, diaR] = refIso.split("-").map(Number);

  let idade = anoR - anoN;
  if (mesR < mesN || (mesR === mesN && diaR < diaN)) idade -= 1;
  return idade;
}

/** Idade hoje, no fuso do projeto. */
export function idadeHoje(
  nascimento: string | Date,
  hojeIso: string = hojeNoProjeto(),
): number {
  const iso = typeof nascimento === "string" ? nascimento : dataParaDia(nascimento);
  return idadeEm(iso, hojeIso);
}

/** Compara dois dias civis. Funciona por ordem lexicográfica do formato ISO. */
export function diaEhFuturo(iso: string, hojeIso: string = hojeNoProjeto()): boolean {
  return iso > hojeIso;
}
