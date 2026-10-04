# Deploy na Vercel

Passo a passo do primeiro deploy e checklist de teste em produção. O projeto
Supabase é **um só** (o do `.env.local`): produção usa o mesmo banco e o mesmo
Storage que o desenvolvimento.

## Antes

1. **Enviar os commits para o GitHub:** `git push`. A Vercel publica o que está
   na `main` do `origin`.
2. **Banco em dia:** `npx prisma migrate status` deve dizer
   "Database schema is up to date". Se não disser, `npx prisma migrate deploy`.
3. **Storage:** `npm run storage:preparar` — idempotente; confirma o bucket
   privado `fotos`.

## Criar o projeto na Vercel

1. Em vercel.com → **Add New… → Project** → importar
   `arthursandim/painel-gestao-projeto-social`.
2. Framework: **Next.js** (detectado sozinho). Build command e output: deixar o
   padrão — o `npm run build` do `package.json` já roda `prisma generate`.
3. **Environment Variables**, marcando **só Production**:

   | Nome | Valor |
   | --- | --- |
   | `DATABASE_URL` | o mesmo do `.env.local` (pooler 6543, com `?pgbouncer=true`) |
   | `DIRECT_URL` | o mesmo do `.env.local` (5432) |
   | `NEXT_PUBLIC_SUPABASE_URL` | o mesmo do `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | o mesmo do `.env.local` |
   | `SUPABASE_SECRET_KEY` | o mesmo do `.env.local` |

   - **Não** cadastrar `SEED_*` nem `DEV_ORIGINS`: só servem no computador.
   - **Nunca** criar `NEXT_PUBLIC_SUPABASE_SECRET_KEY`: o prefixo publica a chave
     no navegador, e o app recusa operar com a chave secreta se ela existir
     (`lib/env.ts`).
   - **Só Production, não Preview:** como o banco é um só, um deploy de preview
     de outra branch gravaria nos dados reais.
4. **Deploy.** A região das funções já vem do `vercel.json`: `gru1`
   (São Paulo), a mesma do Supabase (`sa-east-1`).

## Depois do primeiro deploy

1. **Opcional.** Supabase → **Authentication → URL Configuration → Site URL**:
   trocar `http://localhost:3000` pela URL de produção. O app não depende disso
   — login por senha, usuários criados pelo admin, sem e-mail de confirmação,
   convite nem "esqueci a senha". Só os links que o Supabase manda por e-mail
   usam a Site URL (por exemplo, "Send password recovery" pelo painel dele).
2. Cada `git push` na `main` publica sozinho.

## Checklist de teste em produção

Pelo celular, em HTTPS — é aqui que câmera e PWA funcionam de verdade.

- **Login** com o admin; sair e entrar de novo.
- **Permissão pela URL:** como professor, abrir `/inventario` → 403.
- **Dados do aluno pela visão do professor:** sem telefone, endereço, RG.
- **Chamada perto da meia-noite** (21h–0h): o dia gravado é o de Santa Catarina,
  não o do servidor em UTC.
- **Câmera embutida:** "Tirar foto" abre a prévia ao vivo com a traseira; trocar
  de câmera; fechar → a luz apaga. Negar a permissão → seletor de arquivo com aviso.
  Android e iPhone.
- **Foto:** abrir a URL pública
  `<NEXT_PUBLIC_SUPABASE_URL>/storage/v1/object/public/fotos/alunos/A0001.jpg` → erro.
- **PWA no Android:** menu do Chrome → **Instalar app** → ícone da engrenagem na
  tela inicial; abre sem a barra do navegador.
- **Sem conexão:** modo avião com o app aberto → recarregar → tela "Sem conexão";
  voltar a rede → "Tentar de novo".
- **Nada de aluno em cache:** Chrome do computador → DevTools → Application →
  Cache storage → só `engenho-v…` com `offline.html`, ícones e `/_next/static`.

## Se algo der errado

- **Erro 500 logo ao abrir:** variável faltando ou com nome errado. Os logs da
  função na Vercel dizem qual (`lib/env.ts` falha com a mensagem do campo).
- **Build falha no `prisma generate`:** conferir se `DATABASE_URL` e `DIRECT_URL`
  estão cadastradas em Production.
- **Lentidão em toda tela:** conferir a região das funções no painel da Vercel
  (Settings → Functions) — tem que ser `gru1`.
