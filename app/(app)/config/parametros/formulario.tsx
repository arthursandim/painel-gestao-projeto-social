"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { salvarParametros, type EstadoParametros } from "./acoes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  avisoCapacidadeAbaixo,
  CAPACIDADE_MAXIMA,
  CAPACIDADE_MINIMA,
  FALTAS_MAXIMO,
  FALTAS_MINIMO,
} from "@/lib/parametros";

type TurmaParametro = {
  id: string;
  nome: string;
  capacidade: number;
  ativos: number;
  autoria: string;
};

function Salvar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-h-11">
      {pending ? "Salvando…" : "Salvar parâmetros"}
    </Button>
  );
}

function CampoCapacidade({ turma }: { turma: TurmaParametro }) {
  const [valor, setValor] = useState(String(turma.capacidade));
  const aviso = avisoCapacidadeAbaixo(turma.nome, Number(valor), turma.ativos);
  const id = `capacidade_${turma.id}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{turma.nome}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={CAPACIDADE_MINIMA}
          max={CAPACIDADE_MAXIMA}
          step={1}
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-describedby={`${id}_ocupacao`}
          className="h-11 w-28"
        />
        <span id={`${id}_ocupacao`} className="text-muted-foreground text-sm">
          {turma.ativos} {turma.ativos === 1 ? "aluno ativo" : "alunos ativos"}
        </span>
      </div>
      {aviso ? (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}
      <p className="text-muted-foreground text-xs">{turma.autoria}</p>
    </div>
  );
}

export function FormParametros({
  turmas,
  faltas,
  autoriaFaltas,
}: {
  turmas: TurmaParametro[];
  faltas: number;
  autoriaFaltas: string;
}) {
  const [estado, acao] = useActionState<EstadoParametros, FormData>(
    salvarParametros,
    {},
  );
  const [valorFaltas, setValorFaltas] = useState(String(faltas));

  return (
    <form action={acao} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capacidade das turmas</CardTitle>
          <CardDescription>
            Limites independentes. Com a turma cheia, a matrícula exige
            autorização de um administrador, com justificativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {turmas.map((t) => (
            <CampoCapacidade key={t.id} turma={t} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerta de risco de evasão</CardTitle>
          <CardDescription>
            Faltas consecutivas — sequência, não soma — que colocam o aluno no
            card do painel. O termo assinado pelas famílias fala em 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="faltas">Faltas consecutivas</Label>
          <Input
            id="faltas"
            name="faltas"
            type="number"
            inputMode="numeric"
            min={FALTAS_MINIMO}
            max={FALTAS_MAXIMO}
            step={1}
            required
            value={valorFaltas}
            onChange={(e) => setValorFaltas(e.target.value)}
            className="h-11 w-28"
          />
          <p className="text-muted-foreground text-xs">
            Entre {FALTAS_MINIMO} e {FALTAS_MAXIMO}. {autoriaFaltas}
          </p>
        </CardContent>
      </Card>

      {estado.erro ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}
      {estado.ok ? (
        <Alert role="status">
          <AlertDescription>{estado.ok}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Salvar />
        <Button asChild variant="ghost" className="min-h-11">
          <Link href="/config">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
