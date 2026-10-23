/**
 * three/loop.ts
 *
 * O QUE FAZ
 * Loop de `requestAnimationFrame` com orçamento de fps, que pausa com a aba
 * oculta e com o alvo fora da viewport.
 *
 * POR QUE EXISTE
 * Decoração não pode disputar GPU com o trabalho de quem usa a tela. O RAF
 * continua sendo agendado a cada quadro do monitor, mas o desenho só acontece
 * quando o intervalo do orçamento passou; fora da viewport ou com a aba oculta
 * nem o RAF fica agendado. `delta` tem teto para a cena não "pular" depois de
 * uma pausa longa.
 *
 * QUEM USA
 * `montarCena` (scene-host.ts).
 */

const DELTA_MAXIMO_S = 0.06;

export interface Loop {
  /** Começa (ou retoma) respeitando aba e viewport. */
  iniciar: () => void;
  parar: () => void;
}

export function criarLoop({ fps, alvo, aoQuadro }: {
  fps: number;
  /** Elemento observado pelo IntersectionObserver. */
  alvo: Element;
  aoQuadro: (delta: number, agora: number) => void;
}): Loop {
  const intervalo = 1000 / fps;
  let raf = 0;
  let anterior = 0;
  let visivel = true;
  let ativo = false;

  function quadro(agora: number): void {
    if (!ativo || document.hidden || !visivel) return;
    raf = requestAnimationFrame(quadro);
    if (anterior && agora - anterior < intervalo) return;
    const delta = anterior ? Math.min((agora - anterior) / 1000, DELTA_MAXIMO_S) : 0;
    anterior = agora;
    aoQuadro(delta, agora);
  }

  function reagendar(): void {
    cancelAnimationFrame(raf);
    raf = 0;
    anterior = 0;
    if (ativo && visivel && !document.hidden) raf = requestAnimationFrame(quadro);
  }

  const intersecao = typeof IntersectionObserver === "undefined"
    ? undefined
    : new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      reagendar();
    });

  return {
    iniciar() {
      if (ativo) return;
      ativo = true;
      intersecao?.observe(alvo);
      document.addEventListener("visibilitychange", reagendar);
      reagendar();
    },
    parar() {
      ativo = false;
      cancelAnimationFrame(raf);
      raf = 0;
      intersecao?.disconnect();
      document.removeEventListener("visibilitychange", reagendar);
    },
  };
}
