// Os textos dos termos, transcritos dos modelos em docs/.
//
// Moram em código, nunca no banco, porque são o instrumento jurídico: se
// vivessem numa tabela, alguém poderia editá-los por tela e as fichas já
// assinadas passariam a divergir do que o app mostra, sem deixar rastro. Aqui
// eles estão sob controle de versão, e mudar qualquer letra é um commit que
// obriga a incrementar VERSAO_FICHA.
//
// Transcritos caractere a caractere do PDF, incluindo o que parece erro de
// digitação do original — "que devem ser seguidas dará direito", "do(A) atleta"
// com A maiúsculo, "dojô" e "dojo" grafados de dois jeitos na mesma página, e o
// apóstrofo tipográfico de KID’S. Corrigir silenciosamente criaria uma segunda
// geração de documento assinado, que é justamente o que VERSAO_FICHA existe
// para evitar. Se a diretoria quiser o texto revisado, isso é v2 e decisão
// dela, de preferência antes das primeiras assinaturas.
//
// As quebras de linha do PDF não são reproduzidas: elas são resultado da
// justificação do Word, não do texto. O HTML justifica sozinho.

export const CABECALHO_PROJETO = [
  "PROJETO SOCIAL",
  "ENGENHO CIDADÃO",
  "CIDADANIA NO TATAME",
] as const;

// ------------------------------------------------------------ página 2

export const TITULO_CESSAO =
  "CESSÃO DE DIREITO - TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM, ESCRITA, VOZ E SOM";

export const PARAGRAFOS_CESSAO: readonly string[] = [
  "O(a) aluno(a)/atleta acima, devidamente representado(a)/assistido(a) por quem de direito, pelo presente instrumento, autoriza, em caráter gratuito irrevogável e irretratável, o Projeto Social ENGENHO CIDADÃO a captar e fixar a sua imagem e voz durante a realização de qualquer evento oficial ou amistoso, em qualquer suporte existente, ficando o Projeto Social ENGENHO CIDADÃO, desta forma, plenamente capacitado a utilizar a imagem, voz e criações do(A) atleta a seu exclusivo critério, a qualquer tempo, no Brasil e/ou no Exterior, em número ilimitado de vezes, podendo, inclusive fixá-las em películas cinematográficas de qualquer bitola e suportes de computação gráfica em geral, ou armazená-las em banco de dados, exibi-las através de projeção em tela em casas de frequência coletiva ou em locais públicos, transmiti-las via televisão de qualquer espécie (televisão aberta ou por assinatura, através de todas as formas de transporte de sinal existentes, exemplificativamente, cabo, LIVEs e satélite), disseminá-las através da INTERNET e redes sociais, utilizá-las em parques de diversão, inclusive temáticos, ceder os direitos ora adquiridos a terceiros ou ainda, dar às mesmas qualquer outra utilização para o Projeto Social ENGENHO CIDADÃO. Esta autorização não gera e não gerará no futuro e também não ensejará interpretação de existir quaisquer vínculos ou obrigações trabalhistas, securitárias, previdenciária, indenizatória, ou mesmo empregatícia, entre as partes.",
  "Eu compreendi e concordo expressamente com os termos da Cessão de Direito a partir da minha inscrição no Projeto Social ENGENHO CIDADÃO.",
  "Através do presente solicito o meu registro no Projeto Social ENGENHO CIDADÃO, nos termos da declaração abaixo, cuja exatidão assumo inteira responsabilidade.",
  "Projeto Social ENGENHO CIDADÃO desenvolve atividades nas áreas do esporte e cultura onde seus beneficiários têm a oportunidade de participar de todas as atividades seguindo as seguintes normas abaixo:",
  "- Não faltar mais de 3 vezes consecutivas;",
  "- Apresentar justificativas das faltas cometidas;",
  "- Atos que apresente prejuízo a instituição e aos seus, o beneficiário será desligado da instituição;",
  "- O responsável terá que participar de uma reunião todo mês para falar sobre o desenvolvimento do beneficiário, em caso de falta, justificar, se houver três faltas consecutivas o(a) beneficiário(a) será desligado(a) da instituição;",
  "- Se forem notadas algumas mudanças no comportamento da criança ela será submetida a falar com um profissional qualificado da instituição assim como seu responsável.",
];

// ------------------------------------------------------------ página 3, menor

export const TITULO_TERMO_MENOR = "TERMO DE RESPONSABILIDADE";

export const INTRODUCAO_TERMO_MENOR =
  "Mediante o preenchimento e assinatura do presente termo de responsabilidade e autorização, declara e reconhece o RESPONSÁVEL serem verdadeiras as informações preenchidas, bem como estar ciente das obrigações abaixo assumidas em seu nome, e em nome do(a) MENOR/ATLETA, a quem representa neste termo.";

/** Os dez itens, com a numeração transcrita do original. */
export const ITENS_TERMO_MENOR: readonly string[] = [
  "1- O RESPONSÁVEL do(a) MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que o mesmo possui documentação cível original regularizada, não sofrendo de nenhuma doença ou limitação física que desaconselhe ou impeça a participação em treinos e competições amadoras;",
  "2- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que é de sua responsabilidade o deslocamento de ida e retorno do MENOR/PARTICIPANTE DO PROJETO SOCIAL ao/do local de treino;",
  "3- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que é de sua inteira responsabilidade o MENOR/PARTICIPANTE DO PROJETO SOCIAL antes e depois dos treinos na área do projeto, fora do dojô, cabendo a coordenação do projeto apenas a garantia dos horários definidos de treinos;",
  "4- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que como em qualquer outra atividade física, podem ocorrer lesões e ferimentos no MENOR/PARTICIPANTE DO PROJETO SOCIAL durante os treinos, sendo que nenhuma responsabilidade será atribuída diretamente ao projeto;",
  "5- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que se este vier a participar de competições, isentam o projeto de toda e qualquer responsabilidade por eventuais lesões físicas, fraturas, acidentes em geral ou danos de qualquer natureza que venham a ocorrer no desenvolvimento das disputas;",
  "6- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que o projeto, ao participar de competições, não assume qualquer compromisso com o menor, ou mesmo qualquer vínculo trabalhista, especialmente por tratar-se de competições amadoras;",
  "7- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL, especificamente da CATEGORIA KID’S, declara que tem ciência de que devem permanecer na área do projeto durante os treinos no dojo, diante da necessidade específica da faixa etária;",
  "8- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que qualquer conduta antissocial e/ou que atente contra os ensinamentos da prática do Jiu Jitsu, por parte do menor atendido pelo projeto, ensejará em desligamento automático deste;",
  "9- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que é de sua inteira responsabilidade a guarda de objetos fora da área do dojô, assim como qualquer veículo de transporte que se utilize da área do projeto;",
  "10- O RESPONSÁVEL do MENOR/PARTICIPANTE DO PROJETO SOCIAL declara que tem ciência de que responderá por qualquer ato de ilegalidade cometido por si ou pelo menor na área do projeto, isentando este de responsabilidade solidária;",
];

export const ASSINATURA_TERMO_MENOR = "Assinatura dos PAIS e/ou RESPONSÁVEL LEGAL";

// ------------------------------------------------------------ página 3, adulto

export const TITULO_TERMO_ADULTO = "Termos de conhecimento e responsabilidade.";

export const PARAGRAFOS_TERMO_ADULTO: readonly string[] = [
  "Pelo presente, tomo conhecimento de que as atividades deste Projeto Social seguem normas de condutas, que devem ser seguidas dará direito a praticar as atividades do referido projeto, ficando a direção do projeto com o direito de não permitir o ingresso do(a) aluno(a) de participar das atividades quando as normas não forem cumpridas. A falta de assiduidade nas atividades poderá ensejar o cancelamento da inscrição do(a) aluno(a), ficando o seu retorno condicionado a uma nova matrícula e a disponibilidade da vaga no projeto social. As exceções ficam por conta de justificativas feitas por escrito e aceitas pela direção. Declaro por vontade própria que estou apto(a) fisicamente não sofrendo de nenhuma doença ou limitação física que desaconselhe ou impeça a participação em treinos e competições amadoras e que desejo iniciar minha atividade física de imediato, e assumo inteira responsabilidade sobre o que possa vir ocorrer, mesmo tendo conhecimento de que o Projeto Social ENGENHO CIDADÃO não recomenda iniciar toda e qualquer atividade física sem o recomendado exame médico de aptidão física.",
  "Declaro ter ciência de que como em qualquer outra atividade física, podem ocorrer lesões e ferimentos durante os treinos, sendo que nenhuma responsabilidade direta será atribuída ao Projeto Social ENGENHO CIDADÃO.",
  "Desobrigo, descarto e isento voluntariamente o Projeto Social ENGENHO CIDADÃO de toda e qualquer ação, por danos pessoais, prejuízo de propriedade ou mesmo morte não premeditada nas atividades constantes no período a ser utilizado.",
];

export const ACEITE_TERMO_ADULTO =
  "Li e aceito o Termo de Conhecimento e responsabilidade.";

export const ASSINATURA_TERMO_ADULTO = "Aluno";
