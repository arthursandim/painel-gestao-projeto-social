// Consulta de CEP na ViaCEP.
//
// API pública, sem chave. A chamada sai do navegador de quem cadastra e não do
// servidor: o que atravessa é um CEP solto, sem nome nem matrícula, e mandar
// pelo servidor só trocaria o IP de origem sem esconder nada.
//
// O princípio que governa este arquivo: **a consulta nunca pode impedir um
// cadastro**. Se a ViaCEP cair, se a internet do projeto oscilar, se o CEP não
// existir na base — o formulário continua funcionando e a pessoa digita o
// endereço à mão. É a mesma decisão da obrigatoriedade mínima: um serviço de
// terceiro fora do ar não pode ser motivo para um aluno ficar sem cadastro.
import { somenteDigitos } from "@/lib/validacoes";

const URL_VIACEP = "https://viacep.com.br/ws";

/**
 * Cinco segundos.
 *
 * Existe porque `fetch` sem limite espera o tempo que o sistema operacional
 * quiser. Sem isto, uma ViaCEP lenta deixaria o campo em "Consultando…" para
 * sempre, e a pessoa ficaria esperando um preenchimento que não vem em vez de
 * digitar o endereço.
 */
const TEMPO_LIMITE_MS = 5000;

export type EnderecoDoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type MotivoFalha = "formato" | "nao-encontrado" | "indisponivel";

export type ResultadoCep =
  | { ok: true; endereco: EnderecoDoCep }
  | { ok: false; motivo: MotivoFalha };

export const RECADO_FALHA: Record<MotivoFalha, string> = {
  formato: "CEP incompleto — precisa de 8 dígitos.",
  "nao-encontrado": "CEP não encontrado na base dos Correios. Preencha à mão.",
  indisponivel:
    "Não foi possível consultar o CEP agora. Preencha o endereço à mão.",
};

/**
 * Lê a resposta da ViaCEP.
 *
 * Separado da chamada de rede para poder ser testado sem internet — é aqui que
 * mora o que pode dar errado em silêncio. A API responde 200 mesmo quando o CEP
 * não existe, sinalizando por um campo `erro` no corpo; quem confiar no status
 * HTTP preenche o formulário com quatro strings vazias e não percebe.
 *
 * Esse campo já veio como booleano `true` e como string `"true"` conforme a
 * versão, então o teste é de valor presente, não de tipo.
 */
export function interpretarRespostaViaCep(dados: unknown): ResultadoCep {
  if (typeof dados !== "object" || dados === null) {
    return { ok: false, motivo: "indisponivel" };
  }

  const corpo = dados as Record<string, unknown>;

  if (corpo.erro !== undefined && corpo.erro !== false && corpo.erro !== "false") {
    return { ok: false, motivo: "nao-encontrado" };
  }

  const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

  const endereco: EnderecoDoCep = {
    logradouro: texto(corpo.logradouro),
    bairro: texto(corpo.bairro),
    cidade: texto(corpo.localidade),
    estado: texto(corpo.uf).toUpperCase(),
  };

  // Sem cidade e sem UF não sobrou nada aproveitável, e devolver `ok` aqui
  // apagaria um endereço que a pessoa já tinha digitado.
  if (!endereco.cidade && !endereco.estado) {
    return { ok: false, motivo: "nao-encontrado" };
  }

  return { ok: true, endereco };
}

export async function consultarCep(cep: string): Promise<ResultadoCep> {
  const digitos = somenteDigitos(cep);
  if (digitos.length !== 8) return { ok: false, motivo: "formato" };

  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(`${URL_VIACEP}/${digitos}/json/`, {
      signal: controlador.signal,
      headers: { Accept: "application/json" },
    });
    if (!resposta.ok) return { ok: false, motivo: "indisponivel" };
    return interpretarRespostaViaCep(await resposta.json());
  } catch {
    // Rede fora, DNS falhando, tempo esgotado, JSON quebrado: para quem está
    // cadastrando é tudo a mesma coisa — não veio, digite à mão.
    return { ok: false, motivo: "indisponivel" };
  } finally {
    clearTimeout(relogio);
  }
}

/** Máscara progressiva do CEP, no mesmo espírito da de telefone. */
export function mascaraCep(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
