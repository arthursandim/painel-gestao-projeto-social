import { startTransition, useActionState, useRef, type FormEvent } from "react";

/**
 * useActionState sem o reset automático do React 19.
 *
 * Com `<form action={…}>`, o React limpa todo campo não controlado quando a
 * ação termina — inclusive quando ela volta com erro, e quem digitou perde o
 * formulário inteiro. Aqui o envio passa pelo onSubmit: a validação nativa do
 * navegador continua valendo, e nada é limpo a não ser que `limparSe` diga.
 *
 * Como o form não tem mais `action`, useFormStatus não enxerga o envio: o botão
 * recebe `pendente` por prop.
 */
export function useEnvioSemLimpar<E extends object>(
  acao: (anterior: E, form: FormData) => E | Promise<E>,
  inicial: E,
  limparSe?: (estado: E) => boolean,
) {
  const formulario = useRef<HTMLFormElement | null>(null);

  // Os casts só acalmam o Awaited<E> dos tipos do React: E aqui é sempre um
  // objeto de estado simples, nunca uma promessa.
  const [estado, despachar, pendente] = useActionState<E, FormData>(
    (anterior, form) =>
      Promise.resolve(acao(anterior as E, form)).then((resultado) => {
        if (limparSe?.(resultado)) formulario.current?.reset();
        return resultado;
      }),
    inicial as Awaited<E>,
  );

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    formulario.current = evento.currentTarget;
    const botao = (evento.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(evento.currentTarget, botao);
    startTransition(() => despachar(dados));
  }

  return { estado, aoEnviar, pendente };
}
