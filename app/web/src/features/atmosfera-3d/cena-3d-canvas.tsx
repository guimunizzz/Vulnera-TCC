/**
 * features/atmosfera-3d/cena-3d-canvas.tsx
 *
 * Uma atmosfera 3D (relevo ou nebulosa) atrás do conteúdo da área
 * autenticada. Pertence ao chunk lazy que contém three: o bundle principal só
 * conhece `atmosfera-da-plataforma.tsx`, que importa este arquivo por `lazy()`.
 *
 * O risco vem do store (dado real publicado pela tela) e é lido a cada quadro;
 * o tema muda a cena inteira (as cores saem dos tokens na montagem).
 */

import { useRef } from "react";
import { RISCO_NEUTRO } from "./config";
import { useAtmosferaStore } from "./risco";
import type { Linguagem } from "./rotas";
import type { ModoDaVariante } from "./tipos";
import { useCena3d } from "./use-cena-3d";
import { useTemaDoDocumento } from "./use-tema-do-documento";
import { criarNebulosa } from "./variantes/nebulosa";
import { criarRelevo } from "./variantes/relevo";

const FABRICAS = { relevo: criarRelevo, nebulosa: criarNebulosa } as const;

export interface PropsDaCena3d {
  linguagem: Exclude<Linguagem, "ascii">;
  modo: ModoDaVariante;
  chaveDeRota: string;
  aoPronta: () => void;
  aoFalhar: () => void;
}

const obterRisco = () => useAtmosferaStore.getState().risco ?? RISCO_NEUTRO;

function Cena3dCanvas({ linguagem, modo, chaveDeRota, aoPronta, aoFalhar }: PropsDaCena3d) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const raizRef = useRef<HTMLElement>(document.documentElement);
  const tema = useTemaDoDocumento();
  useCena3d(palcoRef, { fabrica: FABRICAS[linguagem], tema, modo, raiz: raizRef, obterRisco, chaveDeRota, aoPronta, aoFalhar });
  return <div ref={palcoRef} aria-hidden="true" data-cena-3d={linguagem} className="absolute inset-0" />;
}

export default Cena3dCanvas;
