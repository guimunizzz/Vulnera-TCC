/**
 * hero-boot.tsx — "boot sequence" de ~1 s antes do título do hero.
 *
 * O QUE FAZ
 * Quatro linhas de terminal aparecem uma a uma sobre o hero; depois o
 * overlay some com fade e o hero faz a entrada normal.
 *
 * POR QUE ASSIM
 * A intro 3D antiga levava 7 s e ignorava movimento reduzido (ADR-050). Este
 * boot recupera o "abrir um terminal" em 1 s e respeita as regras:
 *   - uma vez por sessão (`sessionStorage`), como a intro fazia;
 *   - não toca com movimento reduzido (sistema ou menu) nem quando a página
 *     abre numa âncora (`#demo`): quem chegou com destino não espera;
 *   - pula com o botão, qualquer tecla, clique ou rolagem;
 *   - é decoração (`aria-hidden`): o título do hero continua no DOM o tempo
 *     todo, só a ENTRADA visual espera o boot. O botão "Pular" é o único
 *     elemento focável e fica fora do `aria-hidden`.
 * As linhas são texto de ambientação, não dado: nenhum número inventado.
 */

import { useEffect, useState } from "react";
import { DURACAO } from "../../../motion/tokens";
import { BOOT_LANDING } from "../motion/tokens";
import { marcarBootVisto } from "./hero-boot-estado";

const LINHAS = [
  { prompt: ">", texto: "vulnera init --alvo sua-empresa" },
  { prompt: "ok", texto: "carregando sensores" },
  { prompt: "ok", texto: "mapeando superfície de ataque" },
  { prompt: "ok", texto: "pronto." },
] as const;

export function HeroBoot({ aoTerminar }: { aoTerminar: () => void }) {
  const [visiveis, setVisiveis] = useState(0);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    marcarBootVisto();
    const timers: number[] = [];
    let encerrado = false;

    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      timers.forEach((id) => window.clearTimeout(id));
      setSaindo(true);
      // O hero entra junto com o fade de saída do overlay.
      aoTerminar();
      timers.push(window.setTimeout(() => setVisiveis(-1), DURACAO.fast * 1000));
    };

    LINHAS.forEach((_, i) => {
      timers.push(window.setTimeout(() => setVisiveis(i + 1), i * BOOT_LANDING.passoMs));
    });
    timers.push(window.setTimeout(encerrar, LINHAS.length * BOOT_LANDING.passoMs + BOOT_LANDING.respiroMs));

    const pular = () => encerrar();
    window.addEventListener("keydown", pular);
    window.addEventListener("pointerdown", pular);
    window.addEventListener("wheel", pular, { passive: true });
    window.addEventListener("touchmove", pular, { passive: true });
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("keydown", pular);
      window.removeEventListener("pointerdown", pular);
      window.removeEventListener("wheel", pular);
      window.removeEventListener("touchmove", pular);
    };
    // `aoTerminar` é estável o bastante: o boot roda uma vez por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (visiveis < 0) return null;

  return (
    <div className="vx-boot absolute inset-0 z-[20] flex items-center justify-center px-6" data-saindo={saindo || undefined}>
      <div aria-hidden="true" className="w-full max-w-md font-mono text-sm text-[var(--vx-text-2)] md:text-base">
        {LINHAS.slice(0, visiveis).map((linha) => (
          <p key={linha.texto} className="leading-relaxed">
            <span className="mr-3 text-[var(--vx-accent)]">{linha.prompt === "ok" ? "[ ok ]" : ">"}</span>
            {linha.texto}
          </p>
        ))}
        <span className="vx-blink inline-block h-[1em] w-[0.5em] translate-y-[2px] bg-[var(--vx-accent)]" />
      </div>
      <button
        type="button"
        className="absolute bottom-8 right-6 font-mono text-xs tracking-widest text-[var(--vx-text-3)] hover:text-[var(--vx-accent)]"
      >
        PULAR ›
      </button>
    </div>
  );
}
