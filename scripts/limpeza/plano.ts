// O que o `banco:limpar` oferece e em que ordem apaga.
//
// Puro, sem banco: scripts/verifica-regras.ts confere a escolha, as
// dependências e a ordem.
//
// Turma, Configuracao e Usuario NUNCA entram (decisão do desenvolvedor): são a
// estrutura do projeto e o acesso das pessoas, não dado de teste. O menu nem
// os oferece.

export type Tabela =
  | "Emprestimo"
  | "Presenca"
  | "Documento"
  | "MovimentoEstoque"
  | "ListaEsperaConvertidos"
  | "EventosDeMatricula"
  | "ListaEspera"
  | "Item"
  | "Aluno";

/** Pastas dos buckets que cada grupo esvazia. */
export type Pasta = { bucket: "fotos" | "documentos"; prefixo: string };

export type Grupo = {
  id: "ALUNOS" | "ESPERA" | "INVENTARIO";
  titulo: string;
  explicacao: string;
  tabelas: readonly Tabela[];
  pastas: readonly Pasta[];
  reiniciaMatricula: boolean;
};

/**
 * Cada grupo já carrega o que depende dele por chave estrangeira — apagar
 * alunos sem apagar as presenças seria recusado pelo banco, e apagar só parte
 * deixaria registros apontando para o nada.
 */
export const GRUPOS: readonly Grupo[] = [
  {
    id: "ALUNOS",
    titulo: "Alunos",
    explicacao:
      "Alunos e tudo que aponta para eles: presenças, documentos, empréstimos, os registros da lista de espera já convertidos em aluno e as matrículas acima da capacidade no histórico. Fotos dos alunos no bucket. Reinicia a matrícula em A0001.",
    tabelas: ["Emprestimo", "Presenca", "Documento", "ListaEsperaConvertidos", "EventosDeMatricula", "Aluno"],
    pastas: [
      { bucket: "fotos", prefixo: "alunos" },
      { bucket: "documentos", prefixo: "alunos" },
    ],
    reiniciaMatricula: true,
  },
  {
    id: "ESPERA",
    titulo: "Lista de espera",
    explicacao: "A fila inteira: aguardando, convertidos e removidos.",
    tabelas: ["ListaEspera"],
    pastas: [],
    reiniciaMatricula: false,
  },
  {
    id: "INVENTARIO",
    titulo: "Inventário",
    explicacao: "Itens, movimentos de estoque e empréstimos. Fotos dos itens no bucket.",
    tabelas: ["Emprestimo", "MovimentoEstoque", "Item"],
    pastas: [{ bucket: "fotos", prefixo: "itens" }],
    reiniciaMatricula: false,
  },
];

/**
 * Ordem de execução: quem aponta primeiro, quem é apontado depois. A espera
 * inteira vem antes de Aluno (os convertidos apontam para ele); se ela foi
 * escolhida, o passo "só convertidos" é redundante e sai.
 */
const ORDEM: readonly Tabela[] = [
  "Emprestimo",
  "Presenca",
  "Documento",
  "MovimentoEstoque",
  "ListaEspera",
  "ListaEsperaConvertidos",
  "EventosDeMatricula",
  "Item",
  "Aluno",
];

export type Plano = {
  grupos: readonly Grupo[];
  tabelas: readonly Tabela[];
  pastas: readonly Pasta[];
  reiniciaMatricula: boolean;
};

export function montarPlano(ids: readonly Grupo["id"][]): Plano {
  const grupos = GRUPOS.filter((g) => ids.includes(g.id));
  const pedidas = new Set(grupos.flatMap((g) => g.tabelas));
  if (pedidas.has("ListaEspera")) pedidas.delete("ListaEsperaConvertidos");
  const pastas = grupos.flatMap((g) => g.pastas);
  return {
    grupos,
    tabelas: ORDEM.filter((t) => pedidas.has(t)),
    pastas: pastas.filter(
      (p, i) => pastas.findIndex((q) => q.bucket === p.bucket && q.prefixo === p.prefixo) === i,
    ),
    reiniciaMatricula: grupos.some((g) => g.reiniciaMatricula),
  };
}

/**
 * Lê o que a pessoa digitou no menu: números separados por vírgula ou espaço
 * ("1,3", "1 3"), ou "todos". Número fora do menu, texto estranho ou repetição
 * contraditória → null, e o script pergunta de novo. Vazio → nada escolhido.
 */
export function interpretarEscolha(texto: string): Grupo["id"][] | null {
  const limpo = texto.trim().toLowerCase();
  if (limpo === "") return [];
  if (limpo === "todos") return GRUPOS.map((g) => g.id);
  const partes = limpo.split(/[\s,]+/).filter(Boolean);
  const ids: Grupo["id"][] = [];
  for (const parte of partes) {
    if (!/^\d+$/.test(parte)) return null;
    const grupo = GRUPOS[Number(parte) - 1];
    if (!grupo) return null;
    if (!ids.includes(grupo.id)) ids.push(grupo.id);
  }
  return ids;
}

/** Identificador do projeto Supabase, que a pessoa digita para confirmar. */
export function projetoDaUrl(urlSupabase: string): string | null {
  try {
    const host = new URL(urlSupabase).hostname;
    const [ref] = host.split(".");
    return ref && host.endsWith(".supabase.co") ? ref : null;
  } catch {
    return null;
  }
}

export const AMBIENTES = {
  dev: ".env.local",
  prd: ".env.production.local",
} as const;

export type Ambiente = keyof typeof AMBIENTES;

/** `--ambiente=dev|prd`; sem a flag, dev. Valor estranho → null. */
export function lerAmbiente(argv: readonly string[]): Ambiente | null {
  const flag = argv.find((a) => a.startsWith("--ambiente="));
  if (!flag) return "dev";
  const valor = flag.slice("--ambiente=".length);
  return valor === "dev" || valor === "prd" ? valor : null;
}
