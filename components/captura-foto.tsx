"use client";

import { Camera, ImageUp, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { dimensoesReduzidas, PESO_ALVO_BYTES, QUALIDADES_JPEG } from "@/lib/fotos";

type Estado = { erro?: string; ok?: string };
type Etapa = "fechado" | "camera" | "previa";

/**
 * Foto por dois caminhos lado a lado — câmera embutida ou arquivo — que
 * convergem na mesma confirmação: nada é enviado antes de a pessoa ver a imagem
 * final. Os dois saem redimensionados (lado maior 1024 px, JPEG ~150 kB).
 *
 * O que quebra e está tratado aqui:
 * - getUserMedia exige contexto seguro (HTTPS; localhost também serve). Sem
 *   ele (o `next dev` pelo IP da rede, em HTTP), o botão da câmera abre a câmera
 *   nativa do aparelho por `<input capture>`, que não depende de HTTPS — no
 *   computador, o mesmo input vira seletor de arquivo;
 * - as tracks são encerradas ao capturar, ao cancelar e ao desmontar — senão a
 *   luz da câmera fica acesa;
 * - permissão negada, sem câmera ou navegador embutido de app (iOS) caem no
 *   seletor de arquivo, com aviso. Nunca tela travada;
 * - traseira por padrão, com escolha quando há mais de uma câmera.
 *
 * O teste é de capacidade, nunca de user agent.
 */
export function CapturaFoto({
  id,
  acao,
  aoConfirmar,
  temFoto,
}: {
  /** Registro já gravado: a foto confirmada vai direto para o servidor. */
  id?: string;
  acao?: (estado: Estado, form: FormData) => Promise<Estado>;
  /**
   * Cadastro ainda não gravado: a foto confirmada volta para o formulário, que
   * a envia junto com o "Salvar". Nada sobe antes de o registro existir.
   */
  aoConfirmar?: (foto: Blob) => void;
  temFoto: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [origem, setOrigem] = useState<"camera" | "nativa" | "arquivo">("camera");
  const [aviso, setAviso] = useState("");
  const [estado, setEstado] = useState<Estado>({});
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  // A foto e a URL local da prévia andam juntas: criadas e revogadas no mesmo
  // ponto, para a URL não ficar ocupando memória depois da troca.
  const [foto, setFotoEstado] = useState<{ blob: Blob; url: string } | null>(null);
  const urlAtual = useRef("");
  const setFoto = useCallback((blob: Blob | null) => {
    if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
    urlAtual.current = blob ? URL.createObjectURL(blob) : "";
    setFotoEstado(blob ? { blob, url: urlAtual.current } : null);
  }, []);
  const previa = foto?.url ?? "";
  const [enviando, iniciarEnvio] = useTransition();

  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const seletorArquivo = useRef<HTMLInputElement>(null);
  const seletorNativo = useRef<HTMLInputElement>(null);

  const pararCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const ligarVideo = useCallback(() => {
    const v = video.current;
    if (v && fluxo.current && v.srcObject !== fluxo.current) {
      v.srcObject = fluxo.current;
      void v.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (etapa === "camera") ligarVideo();
  }, [etapa, ligarVideo]);

  // Desmontou (trocou de página no meio da captura): a câmera apaga.
  useEffect(() => pararCamera, [pararCamera]);

  useEffect(() => () => {
    if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
  }, []);

  const fechar = useCallback(() => {
    pararCamera();
    setFoto(null);
    setEtapa("fechado");
  }, [pararCamera, setFoto]);

  useEffect(() => {
    if (etapa === "fechado") return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [etapa, fechar]);

  /** Sem câmera utilizável: aviso e seletor de arquivo, na mesma tela. */
  function cairNoArquivo(motivo: string) {
    pararCamera();
    setEtapa("fechado");
    setAviso(motivo);
    // Ainda dentro do gesto de toque na maioria dos navegadores; se não
    // estiver, o botão "Escolher arquivo" continua ali, ao lado do aviso.
    seletorArquivo.current?.click();
  }

  async function abrirCamera(dispositivo?: string) {
    setEstado({});
    setAviso("");
    if (!navigator.mediaDevices?.getUserMedia) {
      // Sem câmera embutida (HTTP, ou navegador sem a API): a câmera nativa do
      // aparelho. Síncrono, ainda dentro do toque — senão o navegador bloqueia
      // o clique programático.
      setOrigem("nativa");
      seletorNativo.current?.click();
      return;
    }
    pararCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: dispositivo
          ? { deviceId: { exact: dispositivo } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
      });
      fluxo.current = stream;
      setOrigem("camera");
      setEtapa("camera");
      // Na troca de câmera o vídeo já está montado; na abertura, quem liga é o
      // efeito abaixo, depois que a etapa "camera" renderiza.
      ligarVideo();
      // Os rótulos das câmeras só aparecem depois da permissão concedida.
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      setCameras(dispositivos.filter((d) => d.kind === "videoinput"));
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
    } catch (erro) {
      const nome = erro instanceof DOMException ? erro.name : "";
      cairNoArquivo(
        nome === "NotAllowedError"
          ? "Permissão de câmera negada. Escolha um arquivo — ou libere a câmera nas configurações do navegador."
          : nome === "NotFoundError" || nome === "OverconstrainedError"
            ? "Nenhuma câmera encontrada neste aparelho. Escolha um arquivo, ou abra o app pelo celular para tirar a foto."
            : "Não foi possível abrir a câmera. Escolha um arquivo.",
      );
    }
  }

  async function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const blob = await reduzir(v, v.videoWidth, v.videoHeight);
    // Imagem congelada: a câmera apaga enquanto a pessoa decide.
    pararCamera();
    if (blob) {
      setFoto(blob);
      setEtapa("previa");
    } else {
      setEstado({ erro: "Não foi possível capturar a imagem. Tente de novo." });
    }
  }

  async function aoEscolherArquivo(
    arquivo: File | undefined,
    vindoDe: "nativa" | "arquivo",
  ) {
    // Limpo para a mesma imagem poder ser escolhida de novo depois de Refazer.
    if (seletorArquivo.current) seletorArquivo.current.value = "";
    if (seletorNativo.current) seletorNativo.current.value = "";
    if (!arquivo) return;
    setEstado({});
    const blob = await reduzirArquivo(arquivo);
    if (!blob) {
      setEstado({ erro: "Não foi possível ler esta imagem. Escolha uma foto em JPEG ou PNG." });
      return;
    }
    setOrigem(vindoDe);
    setFoto(blob);
    setEtapa("previa");
  }

  function refazer() {
    setFoto(null);
    if (origem === "camera") {
      void abrirCamera(cameraId || undefined);
    } else {
      setEtapa("fechado");
      (origem === "nativa" ? seletorNativo : seletorArquivo).current?.click();
    }
  }

  function usar() {
    if (!foto) return;
    if (aoConfirmar) {
      aoConfirmar(foto.blob);
      setEstado({});
      fechar();
      return;
    }
    if (!id || !acao) return;
    const form = new FormData();
    form.append("id", id);
    form.append("foto", new File([foto.blob], "foto.jpg", { type: "image/jpeg" }));
    iniciarEnvio(async () => {
      const resultado = await acao({}, form);
      setEstado(resultado);
      if (resultado.ok) fechar();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => abrirCamera()}>
          <Camera className="size-4" />
          {temFoto ? "Tirar nova foto" : "Tirar foto"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => seletorArquivo.current?.click()}
        >
          <ImageUp className="size-4" />
          Escolher arquivo
        </Button>
        <input
          ref={seletorArquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => aoEscolherArquivo(e.target.files?.[0], "arquivo")}
        />
        <input
          ref={seletorNativo}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => aoEscolherArquivo(e.target.files?.[0], "nativa")}
        />
      </div>

      {aviso ? (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}
      {estado.ok ? (
        <Alert role="status">
          <AlertDescription>{estado.ok}</AlertDescription>
        </Alert>
      ) : null}
      {estado.erro && etapa === "fechado" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{estado.erro}</AlertDescription>
        </Alert>
      ) : null}

      {etapa !== "fechado" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={etapa === "camera" ? "Tirar foto" : "Confirmar foto"}
        >
          <div className="bg-background w-full max-w-lg space-y-3 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">
                {etapa === "camera" ? "Tirar foto" : "Usar esta foto?"}
              </h2>
              <Button type="button" variant="ghost" size="icon" className="size-11" onClick={fechar} aria-label="Fechar">
                <X className="size-5" />
              </Button>
            </div>

            {etapa === "camera" ? (
              <>
                <video
                  ref={video}
                  className="aspect-[3/4] max-h-[60vh] w-full rounded-md bg-black object-contain"
                  playsInline
                  muted
                  autoPlay
                />
                {cameras.length > 1 ? (
                  <Select
                    aria-label="Câmera"
                    value={cameraId}
                    onChange={(e) => {
                      setCameraId(e.target.value);
                      void abrirCamera(e.target.value);
                    }}
                  >
                    {cameras.map((c, i) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label || `Câmera ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="min-h-11 flex-1" onClick={capturar}>
                    <Camera className="size-4" />
                    Capturar
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-11" onClick={fechar}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                {previa ? (
                  // URL de objeto local (blob:), que o next/image não otimiza.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previa}
                    alt="Prévia da foto"
                    className="max-h-[60vh] w-full rounded-md bg-black object-contain"
                  />
                ) : null}
                {estado.erro ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{estado.erro}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="min-h-11 flex-1" disabled={enviando} onClick={usar}>
                    {enviando ? "Enviando…" : "Usar esta foto"}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={enviando} onClick={refazer}>
                    <RotateCcw className="size-4" />
                    Refazer
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-11" disabled={enviando} onClick={fechar}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Desenha a fonte num canvas já no tamanho final e comprime em JPEG. */
async function reduzir(
  fonte: CanvasImageSource,
  largura: number,
  altura: number,
): Promise<Blob | null> {
  const final = dimensoesReduzidas(largura, altura);
  const canvas = document.createElement("canvas");
  canvas.width = final.largura;
  canvas.height = final.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(fonte, 0, 0, final.largura, final.altura);

  // Desce a qualidade até caber no peso-alvo; se nenhuma couber, fica a menor.
  let blob: Blob | null = null;
  for (const qualidade of QUALIDADES_JPEG) {
    blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
    if (blob && blob.size <= PESO_ALVO_BYTES) break;
  }
  return blob;
}

/**
 * Arquivo escolhido. Passa por <img>, que aplica a orientação do EXIF — foto de
 * celular deitada sairia de lado se fosse desenhada crua.
 */
async function reduzirArquivo(arquivo: File): Promise<Blob | null> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await reduzir(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
