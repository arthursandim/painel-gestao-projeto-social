-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'INSCRICOES', 'INVENTARIO', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "StatusAluno" AS ENUM ('ATIVO', 'DESLIGADO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Modalidade" AS ENUM ('JIU_JITSU');

-- CreateEnum
CREATE TYPE "Graduacao" AS ENUM ('KIDS_BRANCA', 'KIDS_CINZA_BRANCA', 'KIDS_CINZA', 'KIDS_CINZA_PRETA', 'KIDS_AMARELA_BRANCA', 'KIDS_AMARELA', 'KIDS_AMARELA_PRETA', 'KIDS_LARANJA_BRANCA', 'KIDS_LARANJA', 'KIDS_LARANJA_PRETA', 'KIDS_VERDE_BRANCA', 'KIDS_VERDE', 'KIDS_VERDE_PRETA', 'ADULTO_BRANCA', 'ADULTO_AZUL', 'ADULTO_ROXA', 'ADULTO_MARROM', 'ADULTO_PRETA');

-- CreateEnum
CREATE TYPE "ResponsavelTipo" AS ENUM ('PAI', 'MAE', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('FICHA_MENOR', 'FICHA_ADULTO', 'RG_ALUNO', 'ENDERECO_ALUNO', 'RG_RESPONSAVEL', 'ENDERECO_RESPONSAVEL', 'OUTROS');

-- CreateEnum
CREATE TYPE "StatusListaEspera" AS ENUM ('AGUARDANDO', 'CONVERTIDO', 'REMOVIDO');

-- CreateEnum
CREATE TYPE "EstadoConservacao" AS ENUM ('NOVO', 'BOM', 'REGULAR', 'RUIM', 'INSERVIVEL');

-- CreateEnum
CREATE TYPE "StatusEmprestimo" AS ENUM ('EMPRESTADO', 'DEVOLVIDO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "authUserId" UUID,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papeis" "Papel"[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" UUID NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nascimento" DATE NOT NULL,
    "turmaId" UUID NOT NULL,
    "modalidade" "Modalidade" NOT NULL DEFAULT 'JIU_JITSU',
    "graduacao" "Graduacao" NOT NULL,
    "grau" INTEGER NOT NULL DEFAULT 0,
    "sexo" "Sexo" NOT NULL,
    "graduacaoData" DATE,
    "naturalidade" TEXT,
    "nomePai" TEXT,
    "nomeMae" TEXT,
    "responsavelTipo" "ResponsavelTipo",
    "responsavelNome" TEXT,
    "responsavelParentesco" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" CHAR(2),
    "cep" TEXT,
    "telefoneResponsavel" TEXT,
    "telefoneAluno" TEXT,
    "email" TEXT,
    "rg" TEXT,
    "rgOrgaoEmissor" TEXT,
    "rgUf" CHAR(2),
    "rgDataEmissao" DATE,
    "cpf" TEXT,
    "escola" TEXT,
    "serie" TEXT,
    "peso" DECIMAL(5,2),
    "altura" DECIMAL(4,2),
    "fotoPath" TEXT,
    "status" "StatusAluno" NOT NULL DEFAULT 'ATIVO',
    "desligadoEm" TIMESTAMP(3),
    "desligadoMotivo" TEXT,
    "desligadoPorId" UUID,
    "acimaCapacidade" BOOLEAN NOT NULL DEFAULT false,
    "autorizacaoAcimaPorId" UUID,
    "autorizacaoAcimaEm" TIMESTAMP(3),
    "autorizacaoAcimaJustificativa" TEXT,
    "criadoPorId" UUID,
    "atualizadoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presenca" (
    "id" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "data" DATE NOT NULL,
    "presente" BOOLEAN NOT NULL,
    "registradoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "hashSha256" CHAR(64) NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "versaoFicha" TEXT,
    "enviadoPorId" UUID,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaEspera" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "nascimento" DATE NOT NULL,
    "telefone" TEXT,
    "turmaPretendidaId" UUID,
    "dataEntrada" DATE NOT NULL,
    "observacao" TEXT,
    "status" "StatusListaEspera" NOT NULL DEFAULT 'AGUARDANDO',
    "alunoId" UUID,
    "convertidoEm" TIMESTAMP(3),
    "convertidoPorId" UUID,
    "criadoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaEspera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "fotoPath" TEXT,
    "observacao" TEXT,
    "unidadeMedida" TEXT NOT NULL DEFAULT 'un',
    "quantidadeMinima" INTEGER NOT NULL DEFAULT 0,
    "identificacao" TEXT,
    "estadoConservacao" "EstadoConservacao" NOT NULL DEFAULT 'BOM',
    "podeSerEmprestado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprestimo" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "alunoId" UUID NOT NULL,
    "status" "StatusEmprestimo" NOT NULL DEFAULT 'EMPRESTADO',
    "dataEmprestimo" DATE NOT NULL,
    "emprestadoPorId" UUID,
    "dataDevolucao" DATE,
    "recebidoPorId" UUID,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "autorId" UUID,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "atualizadoPorId" UUID,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_authUserId_key" ON "Usuario"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_ativo_idx" ON "Usuario"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_codigo_key" ON "Turma"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_matricula_key" ON "Aluno"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Aluno_cpf_key" ON "Aluno"("cpf");

-- CreateIndex
CREATE INDEX "Aluno_turmaId_status_idx" ON "Aluno"("turmaId", "status");

-- CreateIndex
CREATE INDEX "Aluno_status_idx" ON "Aluno"("status");

-- CreateIndex
CREATE INDEX "Aluno_nome_idx" ON "Aluno"("nome");

-- CreateIndex
CREATE INDEX "Presenca_turmaId_data_idx" ON "Presenca"("turmaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_alunoId_data_key" ON "Presenca"("alunoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_caminho_key" ON "Documento"("caminho");

-- CreateIndex
CREATE INDEX "Documento_alunoId_tipo_vigente_idx" ON "Documento"("alunoId", "tipo", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "ListaEspera_alunoId_key" ON "ListaEspera"("alunoId");

-- CreateIndex
CREATE INDEX "ListaEspera_status_dataEntrada_idx" ON "ListaEspera"("status", "dataEntrada");

-- CreateIndex
CREATE INDEX "Item_ativo_idx" ON "Item"("ativo");

-- CreateIndex
CREATE INDEX "Item_descricao_idx" ON "Item"("descricao");

-- CreateIndex
CREATE INDEX "Emprestimo_itemId_status_idx" ON "Emprestimo"("itemId", "status");

-- CreateIndex
CREATE INDEX "Emprestimo_alunoId_status_idx" ON "Emprestimo"("alunoId", "status");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_itemId_data_idx" ON "MovimentoEstoque"("itemId", "data");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_desligadoPorId_fkey" FOREIGN KEY ("desligadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_autorizacaoAcimaPorId_fkey" FOREIGN KEY ("autorizacaoAcimaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aluno" ADD CONSTRAINT "Aluno_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_turmaPretendidaId_fkey" FOREIGN KEY ("turmaPretendidaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_convertidoPorId_fkey" FOREIGN KEY ("convertidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_emprestadoPorId_fkey" FOREIGN KEY ("emprestadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_recebidoPorId_fkey" FOREIGN KEY ("recebidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_atualizadoPorId_fkey" FOREIGN KEY ("atualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Constraints que o schema.prisma não expressa.
-- O Prisma ignora check constraints ao comparar o datamodel, então elas
-- sobrevivem às próximas migrations sem serem apontadas como drift.

-- Graus vão de 0 a 4 nas duas escalas de graduação.
ALTER TABLE "Aluno"
  ADD CONSTRAINT "Aluno_grau_check" CHECK ("grau" BETWEEN 0 AND 4);

-- Movimento de estoque sem quantidade positiva não é movimento. O sentido do
-- movimento é o tipo (ENTRADA/SAIDA), nunca o sinal da quantidade.
ALTER TABLE "MovimentoEstoque"
  ADD CONSTRAINT "MovimentoEstoque_quantidade_check" CHECK ("quantidade" > 0);
