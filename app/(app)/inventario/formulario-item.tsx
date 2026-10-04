"use client";

import type { EstadoConservacao } from "@prisma/client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { EstadoItem } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { decidirComEmprestimoAberto, ESTADOS, ROTULO_ESTADO } from "@/lib/estoque";

export type ValoresItem = {
  descricao: string;
  categoria: string;
  observacao: string;
  unidadeMedida: string;
  quantidadeMinima: string;
  identificacao: string;
  estadoConservacao: EstadoConservacao;
  podeSerEmprestado: boolean;
};

function Salvar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Salvando…" : children}
    </Button>
  );
}

export function FormularioItem({
  acao,
  valores,
  categorias,
  id,
  emprestados = 0,
  admin,
  cancelar,
  rotuloSalvar,
}: {
  acao: (estado: EstadoItem, form: FormData) => Promise<EstadoItem>;
  valores: ValoresItem;
  /** Categorias já usadas, como sugestão. O campo continua livre. */
  categorias: readonly string[];
  /** Sem id é cadastro, e o cadastro pede a quantidade inicial. */
  id?: string;
  /** Empréstimos em aberto do item, na edição. */
  emprestados?: number;
  admin: boolean;
  cancelar: string;
  rotuloSalvar: string;
}) {
  const [estado, enviar] = useActionState<EstadoItem, FormData>(acao, {});

  // Controlados: o React 19 reseta campos não controlados depois do envio, e um
  // erro de validação apagaria o que foi digitado.
  const [descricao, setDescricao] = useState(valores.descricao);
  const [categoria, setCategoria] = useState(valores.categoria);
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState(valores.unidadeMedida);
  const [minimo, setMinimo] = useState(valores.quantidadeMinima);
  const [identificacao, setIdentificacao] = useState(valores.identificacao);
  const [estadoConservacao, setEstadoConservacao] = useState(valores.estadoConservacao);
  const [emprestavel, setEmprestavel] = useState(valores.podeSerEmprestado);
  const [observacao, setObservacao] = useState(valores.observacao);

  const novo = !id;
  // Só importa quando a edição desmarca um item que era emprestável.
  const decisao =
    valores.podeSerEmprestado && !emprestavel
      ? decidirComEmprestimoAberto("desmarcarEmprestavel", emprestados, admin)
      : null;
  // INVENTARIO não desmarca com empréstimo em aberto: a caixa fica travada. O
  // servidor confere de novo — esconder aqui não é permissão.
  const travado = !admin && valores.podeSerEmprestado && emprestados > 0;

  return (
    <form action={enviar} className="space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            name="descricao"
            required
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Kimono A2 azul, faixa branca, tatame 1 m × 1 m…"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Input
            id="categoria"
            name="categoria"
            list="categorias-usadas"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-11"
          />
          <datalist id="categorias-usadas">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-muted-foreground text-xs">
            Livre. As já usadas aparecem como sugestão.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="identificacao">Identificação</Label>
          <Input
            id="identificacao"
            name="identificacao"
            value={identificacao}
            onChange={(e) => setIdentificacao(e.target.value)}
            placeholder="Código, patrimônio ou etiqueta"
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            Quando importa saber qual unidade está com quem (um kimono), cadastre
            cada unidade como um item de quantidade 1 e preencha aqui.
          </p>
        </div>

        {novo ? (
          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input
              id="quantidade"
              name="quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="h-11"
            />
            <p className="text-muted-foreground text-xs">
              Vira a primeira entrada de estoque. Depois, a quantidade só muda
              por entrada ou saída, com motivo.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="unidadeMedida">Unidade de medida</Label>
          <Input
            id="unidadeMedida"
            name="unidadeMedida"
            required
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            placeholder="un, par, m"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantidadeMinima">Quantidade mínima</Label>
          <Input
            id="quantidadeMinima"
            name="quantidadeMinima"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
            className="h-11"
          />
          <p className="text-muted-foreground text-xs">
            Abaixo dela o item é destacado na lista. 0 é sem mínimo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estadoConservacao">Estado de conservação</Label>
          <Select
            id="estadoConservacao"
            name="estadoConservacao"
            value={estadoConservacao}
            onChange={(e) => setEstadoConservacao(e.target.value as EstadoConservacao)}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ESTADO[e]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="podeSerEmprestado"
              checked={emprestavel}
              disabled={travado}
              onChange={(e) => setEmprestavel(e.target.checked)}
              className="size-5"
            />
            Pode ser emprestado a aluno
          </label>
          {/* Caixa desabilitada não vai no envio; o valor segue escondido. */}
          {travado ? <input type="hidden" name="podeSerEmprestado" value="on" /> : null}
          {travado ? (
            <p className="text-muted-foreground text-xs">
              Com {emprestados === 1 ? "1 unidade emprestada" : `${emprestados} unidades emprestadas`},
              só a administração desmarca. Registre antes a devolução ou a perda.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea
            id="observacao"
            name="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>
      </div>

      {decisao && "aviso" in decisao ? (
        <Alert role="status">
          <AlertDescription>{decisao.aviso}</AlertDescription>
        </Alert>
      ) : null}
      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Salvar>{rotuloSalvar}</Salvar>
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={cancelar}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
