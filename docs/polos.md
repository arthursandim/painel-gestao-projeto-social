# Polos — plano

Item 4 do backlog. Planejado em 2026-10-18; **a execução é futura** e começa só quando o desenvolvedor pedir, depois do item 3 (Aniversariantes).

O projeto se expandiu. Tudo o que o app tem hoje passa a ser da **Matriz**, e cada polo tem a sua estrutura: turmas, alunos, chamada, lista de espera, inventário e usuários.

**Regra que manda neste item: nada do que já existe pode dar errado nem ser perdido.** Os alunos, as presenças, o inventário, o histórico e os usuários continuam como estão e o app, enquanto só houver a Matriz, se comporta exatamente como hoje.

---

## Decisões tomadas

| Ponto | Decisão |
| --- | --- |
| Matriz | É um polo como os outros — o primeiro. Todo dado existente migra para ela |
| Vínculo do usuário | Quem não é `ADMIN` pertence a **um polo** e só vê esse polo: inscrições, professores, inventário, tudo |
| `ADMIN` | **Único papel global.** Vê e administra todos os polos, escolhendo o polo ativo |
| Matrícula | **Sequência única global** (`A0097` pode ser de qualquer polo). Não muda na transferência; caminhos de foto e documento seguem iguais |
| Papéis | Os mesmos quatro. Dentro do polo valem como hoje |

## Modelo de dados

- **`Polo`**: id, código, nome, ativo, autor e timestamps. Endereço só se a ficha precisar (ver decisões em aberto)
- **Recebem `poloId`**: `Turma`, `Item`, `ListaEspera`, `Usuario` (nulo só para quem é exclusivamente `ADMIN`), `EventoHistorico` (nulo hoje só no evento de faltas)
- **`Aluno` não recebe `poloId`.** O polo é o da turma — mesmo raciocínio de não haver coluna de escala: coluna derivável envelhece ou discorda. Presença herda pela turma; empréstimo e movimento, pelo item
- **`Turma.codigo`** deixa de ser único sozinho e passa a ser único por `(poloId, codigo)`. Cada polo tem as suas `KIDS` e `JOVENS_ADULTOS`; o corte dos 12 continua pelo código (`lib/turma.ts`)
- **Parâmetros por polo** (se decidido): tabela nova `ConfiguracaoPolo`, em vez de mudar a chave primária de `Configuracao` — mudança aditiva, a tabela atual fica como está
- **Regra de aplicação**: empréstimo só para aluno do mesmo polo do item; conversão da espera só para turma do polo da espera

## Sessão e acesso

- **Usuário de polo:** o polo vem do cadastro, a cada pedido, no servidor. Não há seletor nem cookie — menos superfície para errar
- **`ADMIN`:** seletor de polo no cabeçalho; o polo ativo vai num cookie que o servidor **revalida a cada pedido** (polo existe e está ativo). Com só a Matriz cadastrada, o seletor não aparece
- **Filtro central no servidor**, como o `selectAlunoPara`: toda consulta de turma, aluno, presença, espera, item, empréstimo, movimento e histórico recebe o polo de um único helper (`lib/polo.ts`). Esconder no React não é permissão
- `verifica-permissoes` passa a conferir que nenhuma consulta dessas tabelas foge do helper, incluindo SQL cru (hoje em `lib/inventario.ts`)
- Um registro de outro polo pedido pela URL responde **404**, não 403 — 403 confirmaria que o registro existe

## Proteção dos dados existentes

Obrigatória, nesta ordem, antes de qualquer migration de polos. O banco é **um só** e é o de produção.

1. **Backup antes de cada migration**: `pg_dump` pela `DIRECT_URL` e cópia dos buckets `fotos` (e `documentos`, se já existir), guardados fora do repositório. Registrar data e contagens no momento do backup
2. **Ensaio fora da produção**: restaurar o backup num Postgres local (Docker) ou num segundo projeto Supabase gratuito, aplicar a migration, rodar a verificação (passo 5) e só então ir à produção
3. **Expandir e depois contrair**, porque todo push na `main` publica e o código antigo continua rodando até o deploy novo:
   - **a.** Cria `Polo`, insere a Matriz, acrescenta `poloId` **nulo** nas tabelas. O código em produção ignora as colunas e segue funcionando
   - **b.** Preenche `poloId = Matriz` onde estiver nulo (`UPDATE … WHERE "poloId" IS NULL`, idempotente)
   - **c.** Publica o código que já grava `poloId` em toda escrita
   - **d.** Só então `NOT NULL`, o índice único composto da turma e a remoção do único antigo de `Turma.codigo`
4. **Proibido nas migrations deste item**: `DROP TABLE`, `DROP COLUMN`, `DELETE`, `TRUNCATE`, renomear coluna, mexer em `Aluno_matricula_seq`. A única remoção permitida é a da restrição de unicidade antiga, depois de a composta existir
5. **Script de verificação** (`npm run verifica:polos`), rodado antes e depois de cada passo:
   - contagem de linhas de toda tabela, igual antes e depois
   - zero linhas com `poloId` nulo depois do passo b
   - saldo de cada item (soma de movimentos) e empréstimos em aberto iguais
   - faltas consecutivas de cada aluno iguais (`lib/frequencia.ts`)
   - próximo valor de `Aluno_matricula_seq` igual
6. **Regressão**: os "Casos de teste críticos" do CLAUDE.md e o checklist de `docs/deploy.md` passam com só a Matriz, antes de cadastrar o segundo polo
7. **`banco:limpar` não roda** em nenhum momento deste item

Os caminhos no Storage não mudam (matrícula global, item por id): **nenhum arquivo é movido.**

## Desafios

| Desafio | Tratamento |
| --- | --- |
| Vazamento entre polos | Helper único, `verifica-permissoes`, teste de URL cruzada por módulo. É o risco principal — dado de menor de um polo visível em outro |
| Migration no banco de produção | Seção acima: backup, ensaio, expandir e contrair, verificação por contagem |
| `banco:limpar` reinicia a matrícula | Com vários polos, limpar por polo **nunca** reinicia a sequência global. Reescrever o plano de limpeza com grupos por polo |
| Transferência de aluno entre polos | Troca de turma para turma de outro polo, só `ADMIN`. Passa pela capacidade do destino (`resolverCapacidade`); empréstimo em aberto no polo de origem é sinalizado, nada é devolvido sozinho; presenças antigas ficam na turma antiga |
| Transferência de item entre polos | Proposta: `SAIDA` no polo de origem e `ENTRADA` no destino, com motivo que aponta um para o outro, numa transação. Barrada com empréstimo em aberto |
| Importação por planilha | Ganha `--polo`; recusa sem ele |
| Painel | Por polo. O `ADMIN` vê o polo ativo; visão consolidada só se decidida, e sem virar relatório (fora do escopo) |
| Custo | Plano gratuito comporta vários polos: 500 MB de banco, 1 GB de storage (~6 mil fotos de 150 kB) |

## Execução em partes

Cada parte: implementar, commit, informar o teste, aguardar confirmação.

| Parte | Entrega | Visível? |
| --- | --- | --- |
| P0 | `verifica:polos`, rotina de backup e ensaio documentada | Não |
| P1 | Passos a e b: `Polo`, Matriz, `poloId` nulo e preenchido | Não — app idêntico |
| P2 | Helper de polo, usuário vinculado ao polo, seletor do admin, código gravando `poloId`; passo d | Só o seletor, com 2+ polos |
| P3 | Alunos, chamada, espera, painel, frequência e aniversariantes filtrados por polo | Não, com só a Matriz |
| P4 | Inventário filtrado por polo | Não, com só a Matriz |
| P5 | `/config/polos`: cadastrar polo (cria as duas turmas), usuários por polo, parâmetros e histórico por polo | Sim |
| P6 | Transferência de aluno e de item, se aprovadas | Sim |
| P7 | Importação `--polo`, `banco:limpar` por polo, revisão do CLAUDE.md | Não |

## Decisões em aberto

Perguntar ao desenvolvedor — algumas são da diretoria — antes da parte que depende delas:

1. Capacidade e N de faltas: por polo ou um só para o projeto? (P5)
2. Um usuário de polo pode atuar em dois polos (professor que dá aula em ambos)? Hoje a decisão é um polo só (P2)
3. Ficha impressa: leva nome ou endereço do polo? Se sim, incrementa `VERSAO_FICHA` (P5)
4. Marca no cabeçalho: a mesma para todos os polos, ou "Equipe Sul Tucujú" muda por polo? (P5)
5. `ADMIN` tem visão consolidada de todos os polos no painel, ou sempre um polo por vez? (P3)
6. Transferência de aluno e de item entram? Com as regras propostas acima? (P6)
7. Polo pode ter turmas além de Kids e Jovens/Adultos? (P5)
8. Polo desativado: o que acontece com os alunos ativos dele? (P5)
