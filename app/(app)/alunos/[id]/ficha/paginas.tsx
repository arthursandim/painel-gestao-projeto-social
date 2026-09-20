// As três páginas da ficha, fiéis aos modelos em docs/.
//
// Estes componentes não consultam nada e não decidem nada: recebem `DadosFicha`
// já formatado e desenham. A variante, a permissão e a formatação ficam em
// page.tsx, porque desenho que também decide é desenho que ninguém consegue
// conferir contra o papel.
//
// As larguras em milímetros de cada linha a preencher foram medidas no PDF
// original. Não arredonde por estética: é o que faz a ficha impressa cair em
// cima do modelo quando as duas são postas uma sobre a outra contra a luz.
import Image from "next/image";

import {
  ACEITE_TERMO_ADULTO,
  ASSINATURA_TERMO_ADULTO,
  ASSINATURA_TERMO_MENOR,
  CABECALHO_PROJETO,
  INTRODUCAO_TERMO_MENOR,
  ITENS_TERMO_MENOR,
  PARAGRAFOS_CESSAO,
  PARAGRAFOS_TERMO_ADULTO,
  TITULO_CESSAO,
  TITULO_TERMO_ADULTO,
  TITULO_TERMO_MENOR,
} from "@/lib/textosFicha";
import { QUEM_ASSINA, VERSAO_FICHA, type VarianteFicha } from "@/lib/ficha";

/**
 * Tudo já em texto pronto para o papel. String vazia significa "não preenchido"
 * e imprime a linha em branco no tamanho do modelo — nunca colapsa, porque é
 * nela que alguém escreve à mão o que faltou no cadastro.
 */
export type DadosFicha = {
  variante: VarianteFicha;
  matricula: string;
  emitidaEm: string;

  nome: string;
  nascimento: string;
  naturalidade: string;
  nomePai: string;
  nomeMae: string;

  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;

  rg: string;
  rgOrgaoEmissor: string;
  rgUf: string;
  rgDataEmissao: string;
  cpf: string;
  escola: string;
  serie: string;

  modalidade: string;
  graduacao: string;
  graduacaoData: string;
  peso: string;
  altura: string;
};

/** Uma linha a preencher, com a largura que tem no modelo. */
function Campo({ mm, children }: { mm: number; children?: string }) {
  return (
    <span
      className="f-campo"
      style={{ "--w": `${mm}mm` } as React.CSSProperties}
    >
      {children ? children : " "}
    </span>
  );
}

function Logo({ classe }: { classe: string }) {
  return (
    <Image
      className={`f-logo ${classe}`}
      src="/logo-projeto-512.png"
      alt="Projeto Social Engenho Cidadão"
      width={512}
      height={512}
      // Eager: imagem que ainda não carregou sai como espaço em branco no papel,
      // e ninguém revisa uma ficha já assinada.
      priority
    />
  );
}

/**
 * Local e data da assinatura, como no modelo.
 *
 * Tudo em branco, inclusive a UF: a decisão foi não fixar localidade nenhuma —
 * o "-SC" do modelo original não corresponde ao projeto. A data também fica em
 * branco porque a assinatura acontece quando a família vem, não quando alguém
 * aperta imprimir; a data de emissão está no rodapé.
 */
function LocalEData() {
  return (
    <p className="f-linha f-centro">
      <Campo mm={34.8} />-<Campo mm={6} />, <Campo mm={5.8} />/
      <Campo mm={11.6} />/<Campo mm={7.7} />
    </p>
  );
}

function Assinatura({ variante }: { variante: VarianteFicha }) {
  return (
    <>
      <p className="f-linha f-centro">
        <Campo mm={63.7} />
      </p>
      <p className="f-p f-centro">{QUEM_ASSINA[variante]}</p>
    </>
  );
}

function Rodape({ dados }: { dados: DadosFicha }) {
  return (
    <p className="f-rodape">
      Ficha {VERSAO_FICHA} · emitida em {dados.emitidaEm} · {dados.matricula}
    </p>
  );
}

// ------------------------------------------------------------ página 1

export function PaginaCadastro({ dados }: { dados: DadosFicha }) {
  return (
    <section className="f-folha">
      <p className="f-vazia">&nbsp;</p>
      <Logo classe="f-logo--p1" />

      {/* A linha em branco depois do título pertence a este parágrafo, não é um
          parágrafo à parte: no modelo ela vem 13,4 pt abaixo da última linha,
          sem os 8 pt que separam parágrafos. Medido no PDF. */}
      <p className="f-p f-centro f-negrito">
        {CABECALHO_PROJETO.map((linha, i) => (
          <span key={linha}>
            {i > 0 ? <br /> : null}
            {linha}
          </span>
        ))}
        <br />
        &nbsp;
      </p>

      <p className="f-p f-centro">FICHA DE CADASTRO</p>

      <p className="f-p f-negrito">IDENTIFICAÇÃO</p>
      <p className="f-linha">
        Nome completo do aluno
        <br />
        <Campo mm={143}>{dados.nome}</Campo>
      </p>
      <p className="f-linha">
        Nascimento: <Campo mm={32.8}>{dados.nascimento}</Campo>Naturalidade:{" "}
        <Campo mm={67.7}>{dados.naturalidade}</Campo>
      </p>

      <p className="f-p f-negrito">FILIAÇÃO</p>
      <p className="f-linha">
        Nome do pai: <Campo mm={121.7}>{dados.nomePai}</Campo>
      </p>
      <p className="f-linha">
        Nome da mãe: <Campo mm={119.7}>{dados.nomeMae}</Campo>
      </p>
      <p className="f-linha">
        Endereço: <Campo mm={102.4}>{dados.endereco}</Campo>: Nº
        <Campo mm={19.4}>{dados.numero}</Campo>
      </p>
      <p className="f-linha">
        Bairro: <Campo mm={61.8}>{dados.bairro}</Campo> Cidade:{" "}
        <Campo mm={36.7}>{dados.cidade}</Campo> Estado:{" "}
        <Campo mm={7.7}>{dados.estado}</Campo>
      </p>
      <p className="f-linha">
        CEP: <Campo mm={42.5}>{dados.cep}</Campo>
      </p>
      {/* Telefone do responsável. O telefone do aluno, como o sexo e o e-mail,
          nasceu só no digital e não entra na ficha impressa. */}
      <p className="f-linha">
        Telefone: <Campo mm={63.8}>{dados.telefone}</Campo>
      </p>

      <p className="f-vazia">&nbsp;</p>
      <p className="f-p f-negrito">DOCUMENTOS</p>
      <p className="f-p">
        Obrigatório anexar cópia do RG e comprovante de endereço do aluno e do
        responsável
      </p>
      <p className="f-linha">
        Identidade RG nº: <Campo mm={38.7}>{dados.rg}</Campo> Órgão Emissor:{" "}
        <Campo mm={29}>{dados.rgOrgaoEmissor}</Campo> UF:{" "}
        <Campo mm={17.4}>{dados.rgUf}</Campo>
      </p>
      <p className="f-linha">
        Data Emissão RG: <Campo mm={30.9}>{dados.rgDataEmissao}</Campo> CPF:{" "}
        <Campo mm={79.3}>{dados.cpf}</Campo>
      </p>
      <p className="f-linha">
        Escola: <Campo mm={108.1}>{dados.escola}</Campo> Série:{" "}
        <Campo mm={17.4}>{dados.serie}</Campo>
      </p>
      <p className="f-linha">
        MODALIDADE: <Campo mm={42.5}>{dados.modalidade}</Campo> GRADUAÇÃO:{" "}
        <Campo mm={59.9}>{dados.graduacao}</Campo>
      </p>
      <p className="f-linha">
        DATA DA GRADUAÇÃO: <Campo mm={23.2}>{dados.graduacaoData}</Campo>
        {"   "}PESO: <Campo mm={21.2}>{dados.peso}</Campo>
        {"   "}ALTURA: <Campo mm={21.3}>{dados.altura}</Campo>
      </p>

      <p className="f-vazia">&nbsp;</p>
      <LocalEData />
      <Assinatura variante={dados.variante} />

      <Rodape dados={dados} />
    </section>
  );
}

// ------------------------------------------------------------ página 2

/** Idêntica nas duas variantes. Só a legenda da assinatura muda. */
export function PaginaCessao({ dados }: { dados: DadosFicha }) {
  return (
    <section className="f-folha">
      <Logo classe="f-logo--p2" />
      <p className="f-p f-centro f-negrito">{TITULO_CESSAO}</p>

      {PARAGRAFOS_CESSAO.map((paragrafo) => (
        <p key={paragrafo.slice(0, 40)} className="f-p f-justificado">
          {paragrafo}
        </p>
      ))}

      <LocalEData />
      <Assinatura variante={dados.variante} />

      <Rodape dados={dados} />
    </section>
  );
}

// ------------------------------------------------------------ página 3

/** A única página que muda de verdade entre as variantes. */
export function PaginaTermo({ dados }: { dados: DadosFicha }) {
  return dados.variante === "MENOR" ? (
    <TermoMenor dados={dados} />
  ) : (
    <TermoAdulto dados={dados} />
  );
}

function TermoMenor({ dados }: { dados: DadosFicha }) {
  return (
    <section className="f-folha">
      <Logo classe="f-logo--p3" />
      <p className="f-p10 f-centro">{TITULO_TERMO_MENOR}</p>
      <p className="f-p10 f-negrito">IDENTIFICAÇÃO</p>
      <p className="f-p10 f-linha">
        Nome completo do aluno-
        <br />
        <Campo mm={130.8}>{dados.nome}</Campo>
      </p>

      {/* Bloco corrido, sem espaço entre os itens — como no original. */}
      <div className="f-termo-menor">
        <p>{INTRODUCAO_TERMO_MENOR}</p>
        {ITENS_TERMO_MENOR.map((item) => (
          <p key={item.slice(0, 4)}>{item}</p>
        ))}
      </div>

      <div className="f-espaco-assinatura">
        <p className="f-p12 f-centro">
          <Campo mm={87.4} />
        </p>
        <p className="f-p12 f-centro">{ASSINATURA_TERMO_MENOR}</p>
      </div>

      <Rodape dados={dados} />
    </section>
  );
}

function TermoAdulto({ dados }: { dados: DadosFicha }) {
  return (
    <section className="f-folha">
      {/* O modelo de adulto não traz logotipo nesta página. Entra por decisão
          expressa do desenvolvedor, que fez valer a regra do CLAUDE.md —
          "logotipo no cabeçalho de todas as páginas" — sobre a fidelidade ao
          PDF atual. É a única divergência deliberada entre as seis páginas e o
          modelo. */}
      <Logo classe="f-logo--p3" />
      <p className="f-p12 f-centro f-negrito">{TITULO_TERMO_ADULTO}</p>

      <div className="f-termo-adulto">
        {PARAGRAFOS_TERMO_ADULTO.map((paragrafo) => (
          <p key={paragrafo.slice(0, 40)}>{paragrafo}</p>
        ))}
      </div>

      <p className="f-p12">&nbsp;</p>
      <p className="f-p12">{ACEITE_TERMO_ADULTO}</p>
      <p className="f-p12">&nbsp;</p>
      <p className="f-p12">&nbsp;</p>
      <p className="f-p12">&nbsp;</p>

      <p className="f-p12 f-centro">
        <Campo mm={83.2} />
      </p>
      <p className="f-p12 f-centro">{ASSINATURA_TERMO_ADULTO}</p>

      <Rodape dados={dados} />
    </section>
  );
}
