# Projeto Social Engenho Cidadão — app de gestão

Aplicativo web interno. Usuários: diretoria e professores. **Alunos e responsáveis não acessam.**

O domínio central é **vaga**, não presença. Presença é o sensor que detecta vaga ociosa. O ciclo que o sistema sustenta: aluno evade → vaga libera → alguém da lista de espera entra.

**Princípio que governa todo o app: o sistema sinaliza, a pessoa decide.** Nenhum desligamento, liberação de vaga, troca de turma ou mudança de escala acontece automaticamente.

---

## Stack (não trocar sem motivo)

| Peça | Escolha |
| --- | --- |
| Framework | Next.js, App Router, TypeScript |
| Banco | Postgres via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth |
| Storage | Supabase Storage, bucket privado |
| UI | Tailwind + shadcn/ui |
| Validação | Zod |
| Deploy | Vercel |

Custo alvo: R$ 0/mês. Volume: 80 alunos, ~10 usuários, ~200 MB de arquivo.

### Estrutura

```
app/
  (auth)/login
  (app)/painel
  (app)/alunos          lista, [id], novo, [id]/ficha
  (app)/chamada
  (app)/espera
  (app)/inventario
  (app)/config          usuarios, parametros
  api/
lib/                    auth, permissoes, storage, validacoes
components/
prisma/schema.prisma
```

---

## Escopo da v1

1. Autenticação e usuários
2. Cadastro de alunos
3. Documentos (ficha em PDF, upload, versionamento)
4. Chamada
5. Lista de espera
6. Inventário
7. Painel de pendências (tela inicial)

### Fora do escopo — não implementar

Acesso de aluno ou responsável · relatórios e gráficos · notificações (e-mail, SMS, WhatsApp) · histórico de graduação · funcionamento offline · controle financeiro · múltiplas unidades.

---

## Perfis e permissões

Quatro papéis fixos em código, sem tela de permissão granular. **Um usuário pode acumular vários papéis — o campo é uma lista.**

| Papel | Pode |
| --- | --- |
| `ADMIN` | Tudo, mais criar/desativar usuários e editar configurações |
| `INSCRICOES` | Alunos, documentos, lista de espera, chamada |
| `INVENTARIO` | Itens, empréstimos, estoque |
| `PROFESSOR` | Chamada e consulta de alunos, com visão reduzida |

Usuários são criados **apenas por admin**. Não existe auto-cadastro.

### Visibilidade por campo (crítico)

A mesma tela mostra menos dados dependendo do papel. **A API precisa devolver menos dados — esconder no React não é permissão.**

| Campo | Professor | Inscrições / Admin |
| --- | --- | --- |
| Nome, matrícula, turma | Sim | Sim |
| Nascimento e idade | Sim | Sim |
| Sexo | Sim | Sim |
| Graduação, peso, altura | Sim | Sim |
| Nome do pai e da mãe | Sim | Sim |
| Foto | Sim | Sim |
| Telefone, e-mail, endereço | **Não** | Sim |
| RG, CPF, órgão emissor | **Não** | Sim |
| Escola e série | **Não** | Sim |
| Documentos digitalizados | **Não** | Sim |

Implementação: um único seletor no backend, `selectAlunoPara(papel)`, decide os campos retornados.

---

## Modelo de dados

Entidades: `Usuario`, `Turma`, `Aluno`, `Presenca`, `Documento`, `ListaEspera`, `Item`, `Emprestimo`, `MovimentoEstoque`, `Configuracao`.

### Regras estruturais

- **Nada é apagado.** Aluno desligado muda de status. Documento substituído vira não-vigente. Empréstimo devolvido muda de status.
- **Presença é gravada explicitamente para todos** (presentes e ausentes) no fechamento da chamada, para que a contagem de faltas consecutivas não precise inferir ausência de linha.
- **Toda escrita relevante guarda autor e timestamp.**

### Enums

- `Papel`: `ADMIN`, `INSCRICOES`, `INVENTARIO`, `PROFESSOR`
- `StatusAluno`: `ATIVO`, `DESLIGADO`
- `Sexo`: `M`, `F`
- `Modalidade`: `JIU_JITSU` (único valor por ora; o campo existe para evitar migração futura)
- `TipoDocumento`: `FICHA_MENOR`, `FICHA_ADULTO`, `RG_ALUNO`, `ENDERECO_ALUNO`, `RG_RESPONSAVEL`, `ENDERECO_RESPONSAVEL`, `OUTROS`
- `StatusEmprestimo`: `EMPRESTADO`, `DEVOLVIDO`, `PERDIDO`
- `Graduacao`: duas escalas independentes, com a escala no prefixo do valor (ver abaixo)

### Notas por entidade

- `Turma` guarda `capacidade` própria, **editável em configuração**, nunca fixa em código. Kids e Jovens/Adultos têm limites independentes.
- `Aluno` tem `matricula` sequencial única (`A0001`). Dados cadastrais são sobrescritos na edição. Guarda a autorização de matrícula acima da capacidade: quem autorizou, quando, justificativa.
- `Presenca` é única por (aluno, data).
- `Configuracao` guarda o N de faltas para alerta e a capacidade de cada turma.

---

## Cadastro de aluno

### Obrigatoriedade mínima — decisão de produto

**Obrigatórios apenas:** nome, nascimento, turma, modalidade, graduação, sexo.

Documentos pessoais (RG, CPF, comprovante) ficam opcionais **de propósito**: em projeto social boa parte das crianças chega sem documento em mãos, e formulário rígido produz cadastro não feito ou dado inventado. No lugar da obrigatoriedade, há um **indicador de completude** e o aluno aparece no painel de pendências.

### Campos

Matrícula (automática) · nome · nascimento · turma · naturalidade · nome do pai · nome da mãe · endereço, número, bairro, cidade, estado, CEP · telefone do responsável · telefone do aluno · RG, órgão emissor, UF, data de emissão · CPF · escola e série · modalidade · graduação · data da graduação · peso · altura · sexo · e-mail · status.

**Só no digital, não vão na ficha impressa:** sexo, e-mail, telefone do aluno.

### Validações

- CPF com dígito verificador, quando preenchido
- CEP no formato `00000-000`, com consulta à ViaCEP — ver abaixo
- Nascimento no passado, idade plausível
- Telefone com DDD
- Idade incompatível com a turma → **alerta, nunca bloqueio**
- Nome igual a um já existente → aviso de possível duplicidade

### Consulta de CEP

O campo de CEP consulta a **ViaCEP** (API pública, sem chave) e preenche logradouro, bairro, cidade e estado.

- A consulta dispara quando o campo **perde o foco**, nunca a cada tecla
- Os campos preenchidos **continuam editáveis** — CEP de rua inteira existe, e bairro novo às vezes está desatualizado na base
- CEP não encontrado ou API fora do ar: **aviso discreto e preenchimento à mão**. Nunca bloqueia o cadastro, pelo mesmo princípio da obrigatoriedade mínima — serviço externo indisponível não pode impedir alguém de cadastrar um aluno

### Responsável legal

Nome do pai e nome da mãe, cada um com uma marcação de responsável legal. **As duas são mutuamente exclusivas.**

| Situação | Nome e parentesco |
| --- | --- |
| Pai marcado | Derivados do campo nome do pai; parentesco fixo `Pai`; campos bloqueados |
| Mãe marcada | Derivados do campo nome da mãe; parentesco fixo `Mãe`; campos bloqueados |
| Nenhum marcado | Campos livres (avó, tio, guardião) |

**Referência, não cópia.** O banco guarda `responsavelTipo`: `PAI` | `MAE` | `OUTRO`. O nome é derivado na leitura quando é `PAI` ou `MAE`; só em `OUTRO` existem `responsavelNome` e `responsavelParentesco`. Se fosse cópia, corrigir o nome da mãe deixaria o responsável com o nome antigo e ninguém perceberia.

### Graduação

Lista suspensa com opções pré-definidas, **nunca texto livre** (vai alimentar relatório depois). Rótulo do campo é apenas "Graduação"; a escala aparece como cabeçalho de grupo (`optgroup`) dentro da lista.

| Escala | Idade | Cores |
| --- | --- | --- |
| Kids | Até 15 anos | Branca · Cinza-Branca · Cinza · Cinza-Preta · Amarela-Branca · Amarela · Amarela-Preta · Laranja-Branca · Laranja · Laranja-Preta · Verde-Branca · Verde · Verde-Preta |
| Adulto | 16 anos ou mais | Branca · Azul · Roxa · Marrom · Preta |

Graus: 0 a 4 em ambas.

### O valor gravado carrega a escala

As duas escalas têm faixa branca, então `BRANCA` sozinho é ambíguo. O enum `Graduacao` prefixa cada valor com a escala: `KIDS_BRANCA`, `ADULTO_BRANCA`, `KIDS_VERDE_PRETA`.

**Não existe coluna de escala.** Ela seria estado derivável da data de nascimento e envelheceria: o aluno faz 16 anos, o nascimento não muda, e a coluna passa a mentir — ou é atualizada e passa a contradizer a faixa gravada. Duas colunas podem discordar entre si; uma não discorda de si mesma.

Com o prefixo, tanto "a faixa escolhida não existe na nova escala" quanto o alerta de troca de escala viram comparação de prefixo contra a escala calculada do nascimento, sem tabela de-para.

Custo assumido: mudar a lista de faixas exige migration. Vale enquanto as faixas forem fixas. Se um dia a diretoria quiser editá-las por tela, o certo passa a ser tabela de domínio, não enum.

`grau` é coluna própria, de 0 a 4, com *check constraint* no banco.

### ATENÇÃO: a régua da graduação não é a régua da turma

São **dois cortes diferentes** e é o ponto que mais confunde na implementação:

| Regra | Corte |
| --- | --- |
| Turma | Kids até 11 anos, 11 meses e 29 dias. Aos **12** já é Jovens/Adultos |
| Escala de graduação | Kids até 15 anos. Aos **16** passa para a escala adulta |

O aluno de 12 a 15 anos treina na turma de Jovens/Adultos **usando faixa da escala kids**. Isso é situação normal, não inconsistência.

**A escala é derivada da data de nascimento, nunca da turma.**

### Comportamento dinâmico do seletor

- Digitada ou alterada a data de nascimento, o app recalcula a idade e o seletor passa a oferecer **uma escala só**, em tempo real, sem salvar
- A escala oposta **não** fica disponível. Não é escolha de quem cadastra
- Se uma correção de data cruzar os 16 anos e a faixa já escolhida não existir na nova escala, o campo é limpo e o app avisa

### Avisos no cadastro

Faixas permanentes enquanto a situação persistir. **Informam, nunca agem, e não carregam botão de ação própria.**

- Aluno Kids que completou 12 anos → altere o campo Turma
- Aluno que completou 16 anos com faixa kids → reposicionar na escala adulta
- Aluno que completou 18 anos com ficha de menor vigente
- Menor de idade sem responsável legal definido
- Documento obrigatório faltando
- Matrícula acima da capacidade, com o nome de quem autorizou

Do painel, o card leva à lista e de lá ao cadastro. **Nunca executa a ação.**

### Foto do aluno

Dois caminhos lado a lado:

1. **Tirar foto** — câmera embutida na tela, prévia ao vivo, capturar, imagem congelada com usar/refazer. `getUserMedia` com `facingMode: environment`, frame desenhado num `canvas`.
2. **Escolher arquivo** — seletor comum.

Ambos convergem na mesma confirmação: nada é enviado antes da pessoa ver a imagem final.

Pontos que quebram e precisam estar no código desde o início:

- **HTTPS obrigatório** para `getUserMedia` (`localhost` também serve)
- **Encerrar as tracks** ao fechar o modal — senão a luz da câmera fica acesa
- **Permissão negada ou sem câmera** → cai automaticamente no seletor de arquivo, com aviso. Nunca tela travada
- **iOS**: dentro de navegadores embutidos de apps, `getUserMedia` pode falhar mesmo com permissão
- Seleção de câmera quando há mais de uma, traseira como padrão

Tratamento da imagem: redimensionar no navegador antes do upload (lado maior 1024 px, JPEG, ~150 kB). Uma foto vigente por aluno, substituível, **sem histórico**. A foto **não** entra na tabela de documentos — é campo próprio no cadastro, porque a lista de documentos é a trilha legal auditável.

---

## Ficha impressa

O app gera a ficha **já preenchida**, para impressão, assinatura em papel e digitalização. É o instrumento jurídico do projeto (LGPD, cessão de imagem, termo de responsabilidade). **O layout tem que ser fiel ao modelo atual** (PDFs em `docs/`).

### Um gerador, duas variantes

| Página | Menor | Adulto |
| --- | --- | --- |
| 1 — Ficha de cadastro | Idêntica, assinatura do responsável | Idêntica, assinatura do aluno |
| 2 — Cessão de direito de imagem | Idêntica, assinatura do responsável | Idêntica, assinatura do aluno |
| 3 — Termo | Termo de Responsabilidade, 10 itens | Termo de Conhecimento e Responsabilidade |

Variante escolhida **automaticamente pela data de nascimento**. Sem escolha manual.

### Implementação

Página HTML em A4 com `@media print`, impressa pelo navegador. **Sem biblioteca de PDF.** Textos dos termos em constantes no código, nunca no banco.

- Rota: `/alunos/[id]/ficha`
- Logotipo no cabeçalho de todas as páginas
- Campo vazio imprime como linha em branco do mesmo tamanho
- Quebra de página forçada entre as três
- Rodapé discreto: versão da ficha, data de emissão, matrícula

### Versionamento do template

Constante `VERSAO_FICHA` (começa em `v1`), impressa no rodapé e **gravada no registro do documento**. Sem isso, quando a ficha mudar vão conviver dois layouts sem nada dizer qual é qual — e é irrecuperável depois.

Regra: mudou texto de termo ou campo impresso → incrementa a versão. Ajuste visual não conta.

**A ficha impressa não muda na v1.** Campos que existem só no digital não aparecem nela.

---

## Documentos

**Documento é lista, não campo.** Dado cadastral é sobrescrito; o histórico de documentos permanece inteiro. Substituir marca a versão anterior como não-vigente. Nada é apagado.

Tipos: `ficha-menor` · `ficha-adulto` · `rg-aluno` · `endereco-aluno` · `rg-responsavel` · `endereco-responsavel` · `outros`

A pendência é **por tipo**, não um sim/não único (a ficha exige RG e comprovante do aluno **e** do responsável).

### Nomenclatura

```
{matricula}_{tipo}_{AAAA-MM-DD}_{seq}.{ext}
```

Exemplo: `A0042_rg-aluno_2026-09-19_01.pdf`
Caminho: `alunos/A0042/rg-aluno/A0042_rg-aluno_2026-09-19_01.pdf`

- **Matrícula, não nome** — nome de criança em nome de arquivo é dado pessoal exposto em log, URL e listagem de bucket
- **Data ISO** — ordena sozinha, sem ambiguidade dia/mês
- **Sequencial de 2 dígitos** — dois uploads do mesmo tipo no mesmo dia não colidem; o scan refeito vira `_02` e isso é trilha de auditoria
- A data no nome é a **data do upload**; a data de emissão da ficha vive no banco

### O nome do arquivo não é fonte da verdade

Quem responde "qual é a ficha vigente" é a tabela `Documento`. **O código nunca interpreta o nome do arquivo para tomar decisão.**

Registro: aluno, tipo, nome, caminho, **hash SHA-256**, tamanho, data de upload, usuário, marcador de vigente e — para fichas — a versão do template.

### Storage

Supabase Storage, bucket privado, acesso só por URL assinada de curta duração. **Não usar Google Drive.**

---

## Chamada

Requisito que manda no desenho: **cabe em dois minutos, com 40 crianças no tatame e o professor de pé segurando o celular.**

### Todos presentes por default

A tela abre com todos marcados como presentes. O professor toca **apenas nos ausentes** (normalmente 5 a 8). Um toque por falta, não quarenta por aula.

- Escolha de turma e data, hoje pré-selecionada
- Lista por nome, alvo de toque grande (≥ 44 px)
- Contador visível: presentes, ausentes, total
- Botão de fechar chamada grava tudo de uma vez
- Chamada fechada reabre em modo edição, mostrando quem lançou e quando

### Regras

- Um registro por aluno por data. Refazer **atualiza, nunca duplica**
- Só alunos ativos aparecem
- Data futura bloqueada; data retroativa permitida com aviso visual
- Presença gravada explicitamente para todos

Lançam: `PROFESSOR` e `INSCRICOES`.

---

## Lista de espera

Fila simples: nome, nascimento, telefone, turma pretendida, data de entrada, observação. Dados mínimos de propósito — a pessoa ainda não é aluno.

**Converter em aluno** abre o cadastro completo pré-preenchido. Concluído, o registro sai da fila e fica marcado como convertido, apontando para o aluno criado.

### Capacidade e turma cheia

Capacidade **por turma, editável em configuração**. Limites independentes.

Parâmetros editáveis em tela, só por admin:
- Capacidade de cada turma
- N de faltas consecutivas que dispara o alerta (**default 3**)

A conversão **não é bloqueada** com a turma cheia, mas **exige autorização explícita de um admin**. O sistema registra quem autorizou, quando e a justificativa. A turma passa a mostrar ocupação acima do limite (41/40), deixando a exceção visível. O papel `INSCRICOES` sozinho não consegue estourar a turma.

---

## Inventário

**Um único cadastro de item para tudo. Não existem tipos de item.** O que varia é apenas se o item pode ser emprestado.

Todo item tem quantidade. Kimono identificado é um item de quantidade 1; faixa branca é um item de quantidade 30.

### Campos

Descrição · categoria · foto · observação · quantidade · unidade de medida · quantidade mínima · identificação (opcional: código, patrimônio, etiqueta) · estado de conservação · **pode ser emprestado**.

### Empréstimo

Marcado como emprestável, o item ganha:

- Emprestar, exigindo um aluno ativo, baixando uma unidade do disponível
- Devolução com data e quem recebeu
- Marcação de perdido, com histórico preservado
- Contagem visível: total, disponível, emprestado

**Disponível = total − emprestados.** Ninguém edita esse número direto.

### Quando criar um item por unidade

Quando importa saber **qual** unidade está com quem (kimono), cada unidade é um item próprio, quantidade 1, identificação preenchida. Quando não importa (faixa, tatame), é um item só com a quantidade cheia.

### Movimentos

Entrada e saída com data, quantidade, motivo e autor. **A quantidade atual é derivada dos movimentos, nunca editada direto.** A quantidade informada no cadastro vira o primeiro movimento de entrada.

`Item` **não tem coluna de quantidade.** A ausência da coluna é o que faz a regra acima valer: sem coluna não existe caminho para alguém escrever nela — nem tela, nem script de correção — e o saldo não tem como divergir dos movimentos. O campo quantidade existe no formulário de cadastro, não na tabela.

A quantidade do movimento é sempre positiva, com *check constraint* no banco. O sentido é o tipo (`ENTRADA`/`SAIDA`), nunca o sinal.

### Empréstimo não é saída

**Emprestar não gera movimento de estoque.** O item emprestado continua sendo do projeto e continua no total — só não está disponível. Se o empréstimo gerasse `SAIDA`, o total já cairia e `total − emprestados` descontaria a mesma unidade duas vezes.

**`SAIDA` é só para saída definitiva: perda, descarte, doação.**

Daí a simetria: **marcar um empréstimo como perdido gera `SAIDA`.** O item sumiu do total, e como o status deixa de ser `EMPRESTADO`, ele para de contar como emprestado no mesmo movimento. As duas pontas fecham.

Acesso: só `INVENTARIO` e `ADMIN`.

---

## Painel de pendências

Tela inicial e a mais usada. Cinco alertas, cada card leva à lista correspondente.

| Alerta | Regra |
| --- | --- |
| Risco de evasão | N faltas consecutivas, configurável, default 3 |
| Documento pendente | Falta algum tipo obrigatório vigente |
| Troca de turma | Aluno Kids completou 12 anos |
| Troca de escala | Aluno completou 16 anos com faixa kids |
| Ficha a refazer | Aluno completou 18 anos com ficha de menor |

**Nenhum alerta dispara ação automática.** São listas para uma pessoa resolver.

Mostra também a ocupação de cada turma contra a capacidade configurada, destacando a que estiver acima do limite.

O default 3 não é arbitrário: os termos assinados pelas famílias estabelecem que três faltas consecutivas ensejam desligamento. O termo fala em desligamento automático; **o app é deliberadamente mais cauteloso.**

---

## Navegação

O cabeçalho leva às telas principais dos módulos. **Toda subtela tem botão de retorno visível para a tela principal da sua categoria** — `/config/usuarios` volta para `/config`, `/alunos/[id]` volta para `/alunos`.

Formulário de criação ou edição tem, além disso, **cancelamento explícito**, ao lado do botão que salva.

O destino é escrito na chamada, nunca `history.back()`: quem chega por URL digitada, por link ou depois de um redirect não tem histórico útil, e o botão precisa funcionar igual nos três casos.

Componente: `components/botao-voltar.tsx`.

---

## Responsividade

Todos os módulos funcionam em computador e celular. **Não existe tela exclusiva de um dos dois, e nada é bloqueado por tipo de dispositivo.**

Um ponto de quebra, em 768 px. Abaixo: navegação recolhida, formulários em uma coluna, tabelas viram cartões empilhados — **nunca rolagem horizontal**.

### Aviso por capacidade, não por aparelho

Quando um recurso depende de algo que o dispositivo pode não ter, testar a **capacidade**, nunca o user agent (erra em notebook com webcam, tablet, celular com permissão negada).

| Situação | O que o app faz |
| --- | --- |
| Sem câmera ou permissão negada | Mostra aviso e mantém o botão de escolher arquivo. Sugere abrir pelo celular |
| Impressão da ficha em tela pequena | Funciona, mas avisa que A4 pelo celular sai desalinhado |

O aviso **acompanha o recurso**; nunca substitui a tela por "acesse pelo outro dispositivo".

---

## Identidade visual

Duas marcas, com usos separados:

| Marca | Onde aparece |
| --- | --- |
| Projeto Social Engenho Cidadão | Cabeçalho do app, ficha impressa e favicon |
| Equipe Sul Tucujú | Cabeçalho do app, à direita da primeira. **Não entra na ficha impressa** |

No cabeçalho, as duas logos ficam lado a lado, seguidas do nome em duas linhas: "Engenho Cidadão" em cima e "Equipe Sul Tucujú" em linha menor abaixo. O nome escrito é o que dá sentido ao segundo símbolo.

As duas marcas são predominantemente pretas. Sobre o cabeçalho escuro, cada uma fica dentro de um chip claro de cantos arredondados (não circular — a engrenagem do Engenho Cidadão tem dentes que chegam aos cantos do enquadramento).

Arquivos em `public/`: `logo-projeto.png` e `logo-equipe.png`, PNG com transparência, nos tamanhos 512, 256 e 64 px. Caminho fixo no código, **nunca no banco**.

A ficha impressa segue apenas com a marca do projeto. Acrescentar a segunda ali incrementaria a `VERSAO_FICHA` e criaria duas gerações de documento assinado — decisão da diretoria, de preferência antes das primeiras assinaturas.

---

## PWA

O app será instalável na tela inicial do Android como PWA. **Não haverá APK nem publicação em loja** — o ícone na tela inicial é o que os usuários querem quando pedem "um aplicativo", sem o custo de build Android, assinatura e revisão de loja.

**Isso entra depois da fase 6, nunca antes.** Service worker durante o desenvolvimento cacheia versão antiga e produz bug fantasma, caro de diagnosticar em projeto solo.

Quando for implementado:

- `manifest.json` com nome "Engenho Cidadão", nome curto "Engenho", tema `#16130F`, fundo `#F5F3EF`, `display: standalone`, ícones 192 e 512 mais *maskable*, a partir de `public/logo-projeto.png`
- Service worker registrado **somente em produção**
- Estratégia **network-first para tudo**, com cache apenas como último recurso. O app não funciona offline por decisão de escopo, e dado de aluno desatualizado em cache é pior que erro de rede — o professor abriria a chamada e veria a turma de duas semanas atrás sem desconfiar
- **Nunca cachear dado de aluno, documento ou foto**
- Cache versionado, com limpeza dos antigos na ativação

---

## Roteiro — implementar uma fase por vez

Não começar uma fase antes da anterior estar funcionando de verdade.

1. **Fundação** — projeto Next.js, Supabase conectado, schema Prisma completo, seed com as duas turmas e um admin. Pronto quando `npx prisma studio` mostra as tabelas.
2. **Autenticação e permissões** — login, sessão, quatro papéis, middleware de rota, CRUD de usuário restrito a admin. Pronto quando um professor não consegue abrir a rota de inventário nem pela URL.
3. **Cadastro de alunos** — formulário, Zod, matrícula automática, lista com busca e filtro, edição.
4. **Ficha em PDF** — template A4, variantes, impressão. Pronto quando a ficha impressa é idêntica ao modelo atual.
5. **Documentos** — upload, nomenclatura, hash, versionamento, completude.
6. **Chamada** — tela, default presente, edição, consulta de faltas consecutivas. Pronto quando 40 alunos são chamados em menos de dois minutos no celular.
7. **Lista de espera e painel** — fila, conversão, os cinco alertas, configuração.
8. **Inventário** — itens, empréstimos, movimentos.

---

## Fluxo de trabalho

Uma fase por vez, na ordem do roteiro. Nunca começar a seguinte por iniciativa própria.

Ciclo obrigatório de cada fase:

1. Implementar
2. Commit, em Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
3. Informar ao desenvolvedor o que testar, com passos e resultado esperado
4. Aguardar confirmação antes de seguir
5. Confirmada a fase, entregar em **seção própria** um prompt pronto para colar, que abra a fase seguinte em outra sessão

Fase grande demais para um commit só: dividir em partes testáveis e aplicar o mesmo ciclo em cada parte. Problema reportado vira correção com novo commit antes de prosseguir.

### O prompt de passagem

Existe porque a sessão seguinte começa sem nada do que foi conversado nesta. O que não estiver escrito nele ou no repositório está perdido — e o prejuízo não é refazer trabalho, é refazer diferente, contrariando decisão já tomada.

Escrito para quem chega do zero, nunca "continue de onde paramos". Contém:

- Em que fase o projeto está e qual é a próxima, com o commit em que a anterior terminou
- O escopo da fase, conforme o roteiro, e o critério de pronto
- As seções deste documento que precisam ser relidas antes de começar
- O que já existe e vai ser usado — módulos, componentes, convenções — para não ser reimplementado
- As decisões em aberto e as armadilhas conhecidas da fase

Vai em bloco de código, para ser copiado inteiro sem edição.

Antes de começar cada fase, reler a seção deste documento que trata dela — em especial a de graduação, que tem dois cortes de idade diferentes.

Se algo a implementar contrariar este documento, ou se o documento for ambíguo, parar e perguntar ao desenvolvedor. Nunca decidir sozinho o que o documento já define.

Questão de segurança se trata na hora em que aparece, nunca no fim do turno.

Segredos moram em `.env.local`, nunca em arquivo versionado, e o `.gitignore` cobre `.env*`. O Prisma lê `.env.local` por caminho explícito em `prisma.config.ts` — não trocar por `dotenv/config`.

Nenhuma chave secreta recebe o prefixo `NEXT_PUBLIC_`, que a inlina no bundle do navegador. Só a chave publishable pode ir para o cliente.

---

## Casos de teste críticos

O risco não é o app não funcionar. É funcionar **errado de um jeito que passa despercebido**.

- **Permissão pela API, não pela tela.** Chamar o endpoint de aluno logado como professor e conferir que telefone, endereço, RG e documentos não vêm na resposta.
- **Data de presença.** Lançar perto da meia-noite e conferir o dia gravado. Fuso horário é a fonte clássica de erro silencioso.
- **Chamada refeita.** Fechar, reabrir, alterar, fechar: atualiza, nunca duplica.
- **Faltas consecutivas.** Falta, vem, falta duas vezes **não** é risco de evasão. Testar a sequência, não a soma.
- **Documento substituído.** Duas versões do mesmo tipo; a anterior continua acessível e marcada como não-vigente.
- **Hash.** Confere com o arquivo armazenado.
- **Variante da ficha.** 17 anos e 11 meses → ficha de menor; no dia seguinte ao aniversário de 18, alerta.
- **Corte da turma.** 11 anos, 11 meses e 29 dias → ainda apto a Kids; no dia seguinte, aviso.
- **Corte da escala.** 14 anos em Jovens/Adultos oferece faixas kids **sem aviso nenhum** (é normal). Aos 16, alerta e escala adulta.
- **Turma cheia.** `INSCRICOES` é barrado; admin autoriza e a matrícula grava com o registro da autorização.
- **Empréstimo duplicado.** Emprestar unidade única que já está na rua. **O banco não barra** — regra de aplicação da fase 8.
- **Saída maior que o saldo.** Dar baixa de 5 num item que tem 3. **O banco não barra** — regra de aplicação da fase 8. O *check constraint* garante quantidade positiva, não saldo suficiente.
- **Saldo de estoque.** Quantidade atual sempre bate com a soma dos movimentos — verdadeiro por construção, já que não existe coluna de quantidade. O que precisa mesmo de teste é o empréstimo não mexer no total.
- **Aluno duplicado.** Dois nomes iguais → aviso.
- **Câmera.** Negar permissão → cai no seletor de arquivo, não trava. Fechar o modal no meio da captura → luz da câmera apaga. Testar Android e iPhone.

---

## Riscos de projeto

| Risco | Mitigação |
| --- | --- |
| Os 80 cadastros em papel nunca virarem dado | Decidir a estratégia de digitação antes da fase 3 |
| Chamada lenta e o professor voltar ao caderno | Testar no tatame, com a turma real, ainda na fase 6 |
| Vazamento de dado de menor | Bucket privado, URL assinada, visibilidade por campo, sem cadastro aberto |
| Escopo crescer | A lista de fora do escopo vale como acordo |
| Projeto parar por falta de tempo | Fases entregam valor isoladamente; parar na fase 6 já resolve presença e vaga |
