/**
 * Confere as duas regras que o CLAUDE.md marca como as que falham em silêncio:
 * a visibilidade por campo do aluno e o alcance de cada papel por rota.
 *
 * Não toca no banco nem na rede — lê os mesmos módulos que o app usa. Rode com
 * `npm run verifica:permissoes`.
 *
 * Inclui controles negativos: asserções que devem passar porque o dado
 * *aparece* onde deve aparecer. Sem elas, um seletor que devolvesse um objeto
 * vazio passaria em todo o resto do arquivo e ninguém notaria.
 */
import { Papel } from "@prisma/client";

import { MODULOS, podeAcessar, type RotaModulo } from "../lib/permissoes";
import {
  CAMPOS_VEDADOS_AO_PROFESSOR,
  podeVerDocumentos,
  selectAlunoPara,
} from "../lib/selecaoAluno";

let falhas = 0;

function checa(descricao: string, condicao: boolean) {
  if (condicao) {
    console.log(`  ok    ${descricao}`);
  } else {
    falhas++;
    console.error(`  FALHA ${descricao}`);
  }
}

function campos(papeis: Papel[]): string[] {
  return Object.entries(selectAlunoPara(papeis))
    .filter(([, incluso]) => incluso)
    .map(([campo]) => campo);
}

console.log("\nVisibilidade de campo do aluno");

const doProfessor = campos([Papel.PROFESSOR]);
const deInscricoes = campos([Papel.INSCRICOES]);
const doAdmin = campos([Papel.ADMIN]);

for (const vedado of CAMPOS_VEDADOS_AO_PROFESSOR) {
  checa(
    `professor não recebe "${vedado}"`,
    !doProfessor.includes(vedado),
  );
}

// Controle negativo: os mesmos campos precisam aparecer para quem pode vê-los.
// Se o seletor completo parasse de devolvê-los, o bloco acima continuaria
// verde e a tela de inscrições é que quebraria — em silêncio, aqui.
for (const vedado of CAMPOS_VEDADOS_AO_PROFESSOR) {
  if (vedado === "documentos") continue; // é relação, não coluna
  checa(
    `inscrições recebe "${vedado}"`,
    deInscricoes.includes(vedado),
  );
}

// A tabela do documento: o que o professor vê, e tem que continuar vendo.
for (const permitido of [
  "nome",
  "matricula",
  "turma",
  "nascimento",
  "sexo",
  "graduacao",
  "grau",
  "peso",
  "altura",
  "nomePai",
  "nomeMae",
  "fotoPath",
]) {
  checa(`professor recebe "${permitido}"`, doProfessor.includes(permitido));
}

checa("admin vê tudo que inscrições vê", doAdmin.length === deInscricoes.length);
checa(
  "papel nenhum cai na visão reduzida (default-deny)",
  campos([]).length === doProfessor.length,
);
checa(
  "professor + inscrições recebe a visão completa (união dos papéis)",
  campos([Papel.PROFESSOR, Papel.INSCRICOES]).length === deInscricoes.length,
);
checa(
  "professor + inscrições recebe telefone",
  campos([Papel.PROFESSOR, Papel.INSCRICOES]).includes("telefoneResponsavel"),
);

checa("professor não vê documentos", !podeVerDocumentos([Papel.PROFESSOR]));
checa("inscrições vê documentos", podeVerDocumentos([Papel.INSCRICOES]));
checa("admin vê documentos", podeVerDocumentos([Papel.ADMIN]));

console.log("\nAlcance de rota por papel");

const esperado: Record<Papel, RotaModulo[]> = {
  ADMIN: ["/painel", "/alunos", "/chamada", "/espera", "/inventario", "/config"],
  INSCRICOES: ["/painel", "/alunos", "/chamada", "/espera"],
  INVENTARIO: ["/painel", "/inventario"],
  PROFESSOR: ["/painel", "/alunos", "/chamada"],
};

for (const papel of Object.keys(esperado) as Papel[]) {
  for (const modulo of MODULOS) {
    const deveAbrir = esperado[papel].includes(modulo.rota);
    const abre = podeAcessar([papel], modulo.rota);
    checa(
      `${papel} ${deveAbrir ? "abre" : "não abre"} ${modulo.rota}`,
      abre === deveAbrir,
    );
  }
}

checa(
  "usuário sem papel não abre rota nenhuma",
  MODULOS.every((m) => !podeAcessar([], m.rota)),
);

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} falha(s). As regras de permissão divergiram do CLAUDE.md.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
