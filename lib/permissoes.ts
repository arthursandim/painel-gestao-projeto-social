// Papéis e o que cada um alcança.
//
// Os quatro papéis são fixos em código, sem tela de permissão granular, e um
// usuário acumula vários — por isso tudo aqui recebe uma lista de papéis, nunca
// um papel só.
import { Papel } from "@prisma/client";

export const PAPEIS: readonly Papel[] = [
  Papel.ADMIN,
  Papel.INSCRICOES,
  Papel.INVENTARIO,
  Papel.PROFESSOR,
];

export const ROTULO_PAPEL: Record<Papel, string> = {
  ADMIN: "Administração",
  INSCRICOES: "Inscrições",
  INVENTARIO: "Inventário",
  PROFESSOR: "Professor",
};

export const DESCRICAO_PAPEL: Record<Papel, string> = {
  ADMIN: "Tudo, mais criar/desativar usuários e editar configurações.",
  INSCRICOES: "Alunos, documentos, lista de espera e chamada.",
  INVENTARIO: "Itens, empréstimos e estoque.",
  PROFESSOR: "Chamada e consulta de alunos, com visão reduzida.",
};

/**
 * Mapa único de rota para papéis. O layout de cada módulo consulta esta
 * tabela, e o menu do cabeçalho é montado a partir dela — assim o que aparece
 * no menu e o que o servidor deixa abrir não podem divergir.
 *
 * A chave é a raiz do módulo; as rotas filhas herdam (`/alunos/123` usa
 * `/alunos`). `/config` é o mais restrito por conter o CRUD de usuários.
 */
export const MODULOS = [
  {
    rota: "/painel",
    titulo: "Painel",
    papeis: [Papel.ADMIN, Papel.INSCRICOES, Papel.INVENTARIO, Papel.PROFESSOR],
  },
  {
    rota: "/alunos",
    titulo: "Alunos",
    papeis: [Papel.ADMIN, Papel.INSCRICOES, Papel.PROFESSOR],
  },
  {
    rota: "/chamada",
    titulo: "Chamada",
    papeis: [Papel.ADMIN, Papel.INSCRICOES, Papel.PROFESSOR],
  },
  {
    rota: "/espera",
    titulo: "Lista de espera",
    papeis: [Papel.ADMIN, Papel.INSCRICOES],
  },
  {
    rota: "/inventario",
    titulo: "Inventário",
    papeis: [Papel.ADMIN, Papel.INVENTARIO],
  },
  {
    rota: "/config",
    titulo: "Configuração",
    papeis: [Papel.ADMIN],
  },
] as const satisfies readonly {
  rota: string;
  titulo: string;
  papeis: readonly Papel[];
}[];

export type RotaModulo = (typeof MODULOS)[number]["rota"];

export function papeisDaRota(rota: RotaModulo): readonly Papel[] {
  const modulo = MODULOS.find((m) => m.rota === rota);
  if (!modulo) {
    // Inalcançável pelo tipo, mas se um dia alguém ampliar RotaModulo sem
    // ampliar MODULOS, o certo é negar, não liberar.
    throw new Error(`Rota sem papéis declarados: ${rota}`);
  }
  return modulo.papeis;
}

export function temAlgumPapel(
  papeisDoUsuario: readonly Papel[],
  permitidos: readonly Papel[],
): boolean {
  return papeisDoUsuario.some((papel) => permitidos.includes(papel));
}

export function podeAcessar(
  papeisDoUsuario: readonly Papel[],
  rota: RotaModulo,
): boolean {
  return temAlgumPapel(papeisDoUsuario, papeisDaRota(rota));
}

export function ehAdmin(papeisDoUsuario: readonly Papel[]): boolean {
  return papeisDoUsuario.includes(Papel.ADMIN);
}

/** Módulos que este usuário enxerga no menu. */
export function modulosVisiveis(papeisDoUsuario: readonly Papel[]) {
  return MODULOS.filter((m) => temAlgumPapel(papeisDoUsuario, m.papeis));
}

/**
 * Primeira tela depois do login. O painel alcança os quatro papéis, então a
 * busca só muda de resultado se um dia um papel deixar de alcançá-lo. Usuário
 * sem papel nenhum cai no painel e é barrado lá, com 403 — que é a resposta
 * correta, e não uma tela em branco.
 */
export function rotaInicial(papeisDoUsuario: readonly Papel[]): string {
  return modulosVisiveis(papeisDoUsuario)[0]?.rota ?? "/painel";
}
