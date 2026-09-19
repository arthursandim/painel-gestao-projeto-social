// Validações de formato dos campos brasileiros do cadastro.
//
// Todas são locais, sem consulta externa: o CLAUDE.md dispensa consulta de CEP
// na v1, e um cadastro que depende de rede é um cadastro que não é feito quando
// a internet do projeto cai.

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type Uf = (typeof UFS)[number];

export function ehUf(valor: string): valor is Uf {
  return (UFS as readonly string[]).includes(valor.toUpperCase());
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// ------------------------------------------------------------------- CPF

/**
 * CPF com dígito verificador.
 *
 * Só o formato não serve para nada: 111.111.111-11 tem onze dígitos e é o que
 * alguém digita quando quer preencher o campo sem ter o documento em mãos. A
 * sequência repetida é rejeitada explicitamente porque ela *passa* no cálculo
 * dos dígitos — 111.111.111-11 é aritmeticamente consistente.
 */
export function ehCpfValido(valor: string): boolean {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const numeros = digitos.split("").map(Number);

  for (const posicao of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < posicao; i++) {
      soma += numeros[i] * (posicao + 1 - i);
    }
    const resto = (soma * 10) % 11;
    const verificador = resto === 10 ? 0 : resto;
    if (verificador !== numeros[posicao]) return false;
  }

  return true;
}

/** Normaliza para 000.000.000-00, que é como o campo é gravado e exibido. */
export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return valor;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ------------------------------------------------------------------- CEP

export function ehCepValido(valor: string): boolean {
  return /^\d{5}-?\d{3}$/.test(valor.trim());
}

export function formatarCep(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 8) return valor;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// -------------------------------------------------------------- telefone

/**
 * Telefone com DDD: 10 dígitos (fixo) ou 11 (celular, com o 9 na frente).
 *
 * O DDD válido começa em 11 — não existe DDD iniciado em 0 nem em 1 seguido de
 * 0, e aceitar isso deixaria passar número digitado com o zero da operadora.
 */
export function ehTelefoneValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 10 && d.length !== 11) return false;

  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular de 11 dígitos sempre tem 9 como primeiro dígito do número.
  if (d.length === 11 && d[2] !== "9") return false;

  return true;
}

export function formatarTelefone(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

// ------------------------------------------------------------------ nome

/**
 * Chave de comparação de nomes, para o aviso de possível duplicidade.
 *
 * Tira acento, caixa e espaço repetido. "José da Silva" e "JOSE DA  SILVA" têm
 * a mesma chave — que é o caso real: o mesmo aluno digitado duas vezes por duas
 * pessoas diferentes.
 */
export function chaveDeNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
