import { Card, CardContent } from "@/components/ui/card";

/**
 * Espaço reservado dos módulos que ainda não chegaram no roteiro.
 *
 * A rota existe desde já porque é ela que o guarda de papel protege: sem rota,
 * um professor que digitasse /inventario receberia 404, e 404 não prova que a
 * permissão funciona — só que a tela não existe.
 */
export function ModuloPendente({
  titulo,
  fase,
  descricao,
}: {
  titulo: string;
  fase: number;
  descricao: string;
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm font-medium">Fase {fase} do roteiro</p>
          <p className="text-muted-foreground text-sm">{descricao}</p>
          <p className="text-muted-foreground text-sm">
            A rota já existe e já respeita as permissões. A tela vem na fase
            correspondente.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
