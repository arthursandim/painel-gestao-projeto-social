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

import { podeImprimirFicha } from "../lib/ficha";
import {
  MODULOS,
  podeAcessar,
  podeEscreverAluno,
  type RotaModulo,
} from "../lib/permissoes";
import {
  alunoParaEmprestimo,
  CAMPOS_ALUNO_EMPRESTIMO,
  CAMPOS_VEDADOS_AO_PROFESSOR,
  podeVerDadosSensiveis,
  podeVerDocumentos,
  SELECAO_EMPRESTIMO,
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

// Saúde é a única exceção ao default-deny deste arquivo, e é exceção nos dois
// sentidos: não pode sumir para o professor (ele é quem socorre) nem vazar para
// quem não tem papel nenhum. As duas asserções existem porque as duas falhas
// são silenciosas — a tela não muda de jeito visível em nenhuma delas.
const CAMPOS_DE_SAUDE = [
  "tipoSanguineo",
  "alergias",
  "problemasSaude",
  "medicamentosContinuos",
];

for (const campo of CAMPOS_DE_SAUDE) {
  checa(`professor recebe "${campo}"`, doProfessor.includes(campo));
  checa(`inscrições recebe "${campo}"`, deInscricoes.includes(campo));
  // As duas listas não podem afirmar o contrário uma da outra. Sem esta
  // asserção, alguém que acrescentasse "alergias" aos vedados criaria um
  // arquivo que se contradiz, e só uma das duas regras valeria — a que o
  // código consultasse primeiro.
  checa(
    `"${campo}" não aparece na lista de vedados`,
    !(CAMPOS_VEDADOS_AO_PROFESSOR as readonly string[]).includes(campo),
  );
}

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

console.log("\nEscrita de aluno — abrir a rota não é poder gravar nela");

// A regra que a fase 3 acrescentou. Ela é fácil de perder porque contraria a
// intuição do mapa de rotas: o professor abre /alunos e mesmo assim não pode
// cadastrar, editar nem desligar ninguém.
checa("professor abre /alunos", podeAcessar([Papel.PROFESSOR], "/alunos"));
checa("…e não grava aluno", !podeEscreverAluno([Papel.PROFESSOR]));

checa("inscrições grava aluno", podeEscreverAluno([Papel.INSCRICOES]));
checa("admin grava aluno", podeEscreverAluno([Papel.ADMIN]));
checa("inventário não grava aluno", !podeEscreverAluno([Papel.INVENTARIO]));
checa("sem papel não grava aluno", !podeEscreverAluno([]));
checa(
  "professor + inscrições grava (união dos papéis)",
  podeEscreverAluno([Papel.PROFESSOR, Papel.INSCRICOES]),
);

console.log("\nFicha impressa — abrir /alunos não é poder imprimir a ficha");

// A regra que a fase 4 acrescentou, e a que mais convida ao erro: a rota da
// ficha fica sob /alunos, que o professor abre. Mas a ficha põe no papel RG,
// CPF, telefone, endereço, escola e série — as quatro linhas "Não" da tabela
// de visibilidade. Guardar a rota só com exigirAcesso("/alunos") entregaria
// num PDF o que o seletor de campos recusa a entregar num JSON, e a falha
// seria invisível: a página renderiza, ninguém vê erro nenhum.
checa("professor abre /alunos", podeAcessar([Papel.PROFESSOR], "/alunos"));
checa("…e não imprime a ficha", !podeImprimirFicha([Papel.PROFESSOR]));

checa("inscrições imprime a ficha", podeImprimirFicha([Papel.INSCRICOES]));
checa("admin imprime a ficha", podeImprimirFicha([Papel.ADMIN]));
checa("inventário não imprime a ficha", !podeImprimirFicha([Papel.INVENTARIO]));
checa("sem papel não imprime a ficha", !podeImprimirFicha([]));
checa(
  "professor + inscrições imprime (união dos papéis)",
  podeImprimirFicha([Papel.PROFESSOR, Papel.INSCRICOES]),
);

// A ficha e a visão completa do aluno são a mesma decisão vista de dois
// lados. Se um dia divergirem, alguém poderá imprimir o que não pode ler na
// tela — ou o contrário. Amarrar as duas aqui torna a divergência uma falha
// de script, não uma descoberta em produção.
for (const papeis of [
  [Papel.ADMIN],
  [Papel.INSCRICOES],
  [Papel.PROFESSOR],
  [Papel.INVENTARIO],
  [],
  [Papel.PROFESSOR, Papel.INSCRICOES],
]) {
  checa(
    `imprimir a ficha acompanha ver dados sensíveis (${papeis.join("+") || "sem papel"})`,
    podeImprimirFicha(papeis) === podeVerDadosSensiveis(papeis),
  );
}

console.log("\nVisão do inventário: aluno no empréstimo");

// Registro como a consulta devolveria, com campos a mais de propósito (saúde,
// endereço): a projeção tem que descartá-los mesmo que a seleção um dia os traga.
const registroBase = {
  id: "00000000-0000-4000-8000-000000000001",
  matricula: "A0042",
  nome: "Aluno Teste",
  status: "ATIVO" as const,
  nascimento: new Date("2015-03-10T00:00:00.000Z"),
  turma: { nome: "Kids" },
  responsavelTipo: "MAE" as const,
  responsavelNome: null,
  responsavelParentesco: null,
  nomePai: "PAI-NAO-DEVE-SAIR",
  nomeMae: "Mãe Teste",
  telefoneResponsavel: "(48) 99999-0001",
  telefoneAluno: "(48) 99999-0002",
  alergias: "ALERGIA-NAO-DEVE-SAIR",
  endereco: "ENDERECO-NAO-DEVE-SAIR",
};
const HOJE_PERM = "2026-10-04";
const menorProjetado = alunoParaEmprestimo(registroBase, HOJE_PERM);
const textoMenor = JSON.stringify(menorProjetado);

checa(
  "a projeção entrega exatamente os campos declarados",
  Object.keys(menorProjetado).sort().join() === [...CAMPOS_ALUNO_EMPRESTIMO].sort().join(),
);
for (const vazamento of ["PAI-NAO-DEVE-SAIR", "ALERGIA-NAO-DEVE-SAIR", "ENDERECO-NAO-DEVE-SAIR", "2015-03-10"]) {
  checa(`inventário não recebe "${vazamento}"`, !textoMenor.includes(vazamento));
}
checa("seleção do empréstimo não lê saúde", !("alergias" in SELECAO_EMPRESTIMO));
checa("seleção do empréstimo não lê endereço nem documento", !("endereco" in SELECAO_EMPRESTIMO) && !("cpf" in SELECAO_EMPRESTIMO));

// Controle negativo: o que foi autorizado aparece.
checa("menor: nome do responsável (derivado da mãe)", menorProjetado.contato.nome === "Mãe Teste");
checa("menor: telefone do responsável", menorProjetado.contato.telefone === "(48) 99999-0001");
checa("menor: não leva o telefone do aluno", !textoMenor.includes("99999-0002"));

const adultoProjetado = alunoParaEmprestimo(
  { ...registroBase, nascimento: new Date("2000-01-01T00:00:00.000Z") },
  HOJE_PERM,
);
checa("adulto: telefone do próprio aluno", adultoProjetado.contato.telefone === "(48) 99999-0002");
checa("adulto: sem nome de responsável", adultoProjetado.contato.nome === null);
checa("adulto: não leva o telefone do responsável", !JSON.stringify(adultoProjetado).includes("99999-0001"));

// Corte dos 18 no dia do aniversário, como na ficha.
const vespera = alunoParaEmprestimo({ ...registroBase, nascimento: new Date("2008-10-05T00:00:00.000Z") }, HOJE_PERM);
const aniversario = alunoParaEmprestimo({ ...registroBase, nascimento: new Date("2008-10-04T00:00:00.000Z") }, HOJE_PERM);
checa("17 anos e 364 dias ainda é menor", vespera.menor);
checa("no aniversário de 18 já é adulto", !aniversario.menor);

console.log(
  falhas === 0
    ? "\nTudo certo.\n"
    : `\n${falhas} falha(s). As regras de permissão divergiram do CLAUDE.md.\n`,
);
process.exit(falhas === 0 ? 0 : 1);
