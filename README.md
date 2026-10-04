# Engenho Cidadão — app de gestão

Aplicativo web interno do **Projeto Social Engenho Cidadão** (Equipe Sul Tucujú),
para a diretoria e os professores. Alunos e responsáveis não acessam.

O domínio central é **vaga**: o aluno evade, a vaga libera, alguém da lista de
espera entra. A chamada é o sensor que detecta a vaga ociosa. O princípio que
governa tudo: **o sistema sinaliza, a pessoa decide** — nada é desligado,
movido ou liberado automaticamente.

**Versão 1 — em produção desde 2026-10-04:**
<https://painel-gestao-projeto-social.vercel.app>

> A especificação completa, com todas as regras e decisões, está no
> [CLAUDE.md](CLAUDE.md). Em caso de dúvida, ele é a fonte da verdade.

## O que a v1 faz

| Módulo | Rota | O que tem |
| --- | --- | --- |
| Painel | `/painel` | Alertas de risco de evasão, troca de turma e troca de escala; ocupação das turmas; chamadas da semana; itens emprestados |
| Alunos | `/alunos` | Cadastro com obrigatoriedade mínima, foto (câmera ou arquivo), CEP pela ViaCEP, responsável legal, graduação nas escalas kids e adulto, avisos, desligamento, lista com busca, filtros e ordenação |
| Ficha | `/alunos/[id]/ficha` | Ficha de cadastro, cessão de imagem e termo, já preenchidos, em A4 para imprimir e assinar (variante menor ou adulto pelo nascimento) |
| Chamada | `/chamada` | Todos presentes por padrão, um toque por falta, histórico com edição |
| Lista de espera | `/espera` | Fila por turma, conversão em aluno, remoção com motivo |
| Inventário | `/inventario` | Itens com foto, entradas e saídas de estoque, empréstimos a alunos, devolução e perda; saldo sempre derivado dos movimentos |
| Configuração | `/config` | Usuários e papéis, capacidade das turmas e faltas para alerta, histórico dessas alterações |

Instalável na tela inicial do Android como **PWA**. Funciona igual no
computador e no celular.

### Papéis

| Papel | Alcança |
| --- | --- |
| `ADMIN` | Tudo, mais usuários, parâmetros e histórico |
| `INSCRICOES` | Alunos, lista de espera, chamada |
| `INVENTARIO` | Inventário (vê do aluno só o necessário para o empréstimo) |
| `PROFESSOR` | Chamada e consulta de alunos, sem telefone, endereço nem documentos |

Um usuário pode ter vários papéis. A restrição é feita no servidor: a API
devolve menos dados, não é a tela que esconde.

## Stack

Next.js (App Router, TypeScript) · Postgres no Supabase · Prisma · Supabase Auth
e Storage (buckets privados, URL assinada) · Tailwind + shadcn/ui · Zod · Vercel
(região `gru1`). Custo alvo: R$ 0/mês.

## Rodando localmente

Requisitos: Node 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # e preencher
npx prisma generate
npm run dev                   # http://localhost:3000
```

Variáveis do `.env.local` (detalhes no [.env.example](.env.example)):

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Postgres, pooler de transação (6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Postgres, pooler de sessão (5432), para migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta — só no servidor, **nunca** com prefixo `NEXT_PUBLIC_` |
| `CRON_SECRET` | Protege o cron que mantém o Supabase acordado |
| `SEED_ADMIN_*` | Só para o seed: o primeiro admin |

Para testar no celular pela rede local: `npx next dev -H 0.0.0.0 -p 3000` e
abrir pelo IP do computador. Em HTTP a câmera embutida não abre (cai na câmera
nativa do aparelho); com câmera embutida, use
`npx next dev --experimental-https -H 0.0.0.0 -p 3000`.

### ⚠ Banco único

Existe **um só projeto Supabase**, e ele é o de produção. Tudo o que roda no
computador — o app em desenvolvimento, os scripts, as migrations — grava nos
dados reais.

- Não usar `npm run db:migrate` nem `npm run db:push` (pensados para banco
  descartável). Migration nova: gerar o SQL com
  `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`,
  gravar em `prisma/migrations/<timestamp>_<nome>/migration.sql` e aplicar com
  `npm run db:deploy`. Só mudança aditiva, ou combinada antes.
- Todo push na `main` publica em produção.

### Windows

`npx prisma generate` falha com `EPERM` enquanto o `next dev` estiver rodando
(ele segura o motor do Prisma). Derrubar a árvore do processo do dev, rodar o
generate, conferir "Generated Prisma Client" na saída e subir o dev de novo.

## Scripts

| Comando | Faz |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js (o `build` roda o `prisma generate` antes) |
| `npm run typecheck` · `npm run lint` | TypeScript e ESLint |
| `npm run verifica` | Regras de permissão e de domínio, sem banco: cortes de idade, faixas, saldo de estoque, empréstimos, ordenação, limpeza… |
| `npm run db:deploy` | Aplica as migrations pendentes |
| `npm run db:seed` | Turmas e o primeiro admin |
| `npm run db:studio` | Prisma Studio |
| `npm run importacao:modelo` | Gera a planilha modelo de importação de alunos |
| `npm run importacao:alunos` | Importa alunos da planilha — teste por padrão; `-- --gravar` grava. Opções: `--arquivo=`, `--autor=`, `--justificativa=` |
| `npm run storage:preparar` | Cria/confere o bucket privado `fotos` (idempotente) |
| `npm run banco:limpar` | Limpeza interativa por grupo (alunos, lista de espera, inventário); pede o identificador do projeto antes de apagar. `-- --listar` só mostra; `-- --ambiente=prd` lê `.env.production.local` |
| `npm run pwa:icones` | Regera os ícones do PWA a partir de `public/logo-projeto.png` |

As planilhas de importação ficam em `importacao/`, fora do git — têm dados
pessoais de crianças.

## Estrutura

```
app/
  (auth)/login
  (app)/painel, alunos, chamada, espera, inventario, config
  api/manter-ativo       cron diário que mantém o Supabase acordado
  manifest.ts            manifesto do PWA
components/              UI compartilhada (captura de foto, ordenação, …)
lib/                     regras de domínio, quase todas puras e testadas em scripts/verifica-*
prisma/                  schema e migrations
public/                  logos, ícones, service worker (sw.js), página offline
scripts/                 importação, limpeza, storage, ícones, verificações
docs/                    modelos das fichas em PDF e o passo a passo do deploy
```

## Deploy

Vercel, ligada a este repositório: cada push na `main` publica. Variáveis só em
**Production** (o banco é um só; um preview gravaria nos dados reais). Um cron
diário chama `/api/manter-ativo` para o Supabase gratuito não pausar por
inatividade. Passo a passo e checklist de teste em produção:
[docs/deploy.md](docs/deploy.md).

## Backlog de melhorias

1. **Documentos** — upload dos documentos digitalizados (ficha assinada, RG,
   comprovantes), nomenclatura, hash, versionamento e completude; com ele, os
   alertas "Documento pendente" e "Ficha a refazer", o bloqueio de reimpressão
   da ficha assinada e "visualizar não é baixar". Decisões de armazenamento em
   aberto.
2. **Marca d'água na visualização de documento** — depende do item 1.

Detalhes e decisões já tomadas em [CLAUDE.md › Roteiro › Backlog de melhorias](CLAUDE.md).
