/**
 * features/atmosfera-3d/atmosfera-da-plataforma.tsx
 *
 * O QUE FAZ
 * A atmosfera da área autenticada, escolhida pela seção (`rotas.ts`):
 * nebulosa no Dashboard, relevo com radar no monitoramento e no Exposure
 * Graph, ASCII no trabalho técnico, ASCII parado (pôster) em formulários.
 * Troca de seção = crossfade de 0,8 s. Uma tela pode suprimir a atmosfera
 * (aba Mapa 3D do Exposure Graph) e pedir pings (`atmosfera.store.ts`).
 *
 * COMO
 *   - Cada atmosfera é uma CAMADA. Ao mudar a seção entra uma camada nova; a
 *     de baixo só apaga quando a nova desenhou o primeiro quadro (sem buraco
 *     na troca) e sai do DOM ao fim do fade. No máximo duas vivas.
 *   - Dentro da camada: a cena animada (three, lazy) ou o pôster (canvas 2D,
 *     lazy) — pôster com movimento reduzido, tela estreita, sem WebGL2,
 *     "Pausar animações" (Findings) ou falha da cena. Alto contraste: nada.
 *   - A camada inteira tem a opacidade-teto (`TETO_DA_CAMADA`): é ela que
 *     garante AA ao texto solto. O ASCII animado traz o próprio teto.
 *   - Modo apresentação (Dashboard em tela cheia): a cena vira imersiva —
 *     outra camada, então a entrada também é um crossfade.
 *
 * Nenhum import de three aqui: roda no bundle principal.
 *
 * QUEM USA
 * `AppLayout`.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useModoDeCena } from "../../three/gate";
import { OPACIDADE_ATMOSFERA } from "../../components/dashboard/hero/atmosfera-config";
import "../../components/dashboard/hero/dashboard-atmosphere.css";
import { useApresentacao } from "./apresentacao";
import { DURACAO_TROCA_MS, TETO_DA_CAMADA } from "./config";
import { useAtmosferaStore } from "./atmosfera.store";
import { atmosferaDaRota, type Linguagem } from "./rotas";
import type { PropsDaCena3d } from "./cena-3d-canvas";
import type { ModoDaVariante } from "./tipos-base";
import { useTemaDoDocumento } from "./use-tema-do-documento";
import "./atmosfera.css";

interface PropsDeCarga {
  aoPronta: () => void;
  aoFalhar: () => void;
}

/** Chunk que não baixou: a camada vira pôster, a área de trabalho segue. */
function FalhaAoCarregar({ aoFalhar }: { aoFalhar?: () => void }) {
  useEffect(() => aoFalhar?.(), [aoFalhar]);
  return null;
}

const CenaAscii = lazy<ComponentType<PropsDeCarga>>(() =>
  import("../../components/dashboard/hero/dashboard-ambient-canvas").catch(() => ({ default: FalhaAoCarregar })));
const Cena3d = lazy<ComponentType<PropsDaCena3d>>(() => import("./cena-3d-canvas").catch(() => ({ default: FalhaAoCarregar })));
// Se nem o pôster baixar, a camada fica vazia sobre o fundo CSS.
const Poster = lazy<ComponentType<{ linguagem: Linguagem; aoPronta: () => void }>>(() =>
  import("./poster-da-atmosfera").catch(() => ({ default: () => null })));

type Estilo = "animada" | "poster";

interface Camada {
  id: number;
  chave: string;
  linguagem: Linguagem | null;
  estilo: Estilo;
  modo: ModoDaVariante;
  pronta: boolean;
  falhou: boolean;
}

function novaCamada(id: number, linguagem: Linguagem | null, estilo: Estilo, modo: ModoDaVariante): Camada {
  // Sem atmosfera não há o que esperar: a camada vazia já "desenhou".
  return { id, chave: `${linguagem}|${estilo}|${modo}`, linguagem, estilo, modo, pronta: linguagem === null, falhou: false };
}

export function AtmosferaDaPlataforma({ pausado = false }: { pausado?: boolean }) {
  const { pathname } = useLocation();
  const modoDeCena = useModoDeCena();
  const { ativa: apresentando } = useApresentacao();
  const tema = useTemaDoDocumento();

  const suprimida = useAtmosferaStore((s) => s.supressao !== null);
  const sinal = useAtmosferaStore((s) => s.sinal);

  const atmosfera = modoDeCena === "nenhuma" || suprimida ? null : atmosferaDaRota(pathname);
  const linguagem = atmosfera?.linguagem ?? null;
  const estilo: Estilo = modoDeCena === "animada" && !pausado && !atmosfera?.parada ? "animada" : "poster";
  const modo: ModoDaVariante = apresentando ? "imersivo" : "plataforma";
  const chave = `${linguagem}|${estilo}|${modo}`;

  const proximoId = useRef(1);
  const [camadas, setCamadas] = useState<Camada[]>(() => [novaCamada(0, linguagem, estilo, modo)]);

  useEffect(() => {
    setCamadas((atuais) => {
      if (atuais[atuais.length - 1].chave === chave) return atuais;
      // Fica só a que está à mostra agora (a última pronta) e entra a nova.
      const aMostra = [...atuais].reverse().find((c) => c.pronta);
      return [...(aMostra ? [aMostra] : []), novaCamada(proximoId.current++, linguagem, estilo, modo)];
    });
  }, [chave, linguagem, estilo, modo]);

  const topo = camadas[camadas.length - 1];
  useEffect(() => {
    if (!topo.pronta || camadas.length === 1) return;
    const espera = window.setTimeout(() => setCamadas((atuais) => atuais.filter((c) => c.id === topo.id)), DURACAO_TROCA_MS);
    return () => window.clearTimeout(espera);
  }, [topo.id, topo.pronta, camadas.length]);

  const marcar = useCallback((id: number, mudanca: Partial<Pick<Camada, "pronta" | "falhou">>) => {
    setCamadas((atuais) => atuais.map((c) => (c.id === id ? { ...c, ...mudanca } : c)));
  }, []);

  return (
    <>
      <div aria-hidden="true" className="dashboard-atmosphere-fallback pointer-events-none absolute inset-0" />
      {camadas.map((camada) => {
        if (camada.linguagem === null) return null;
        const visivel = camada.id === topo.id ? camada.pronta : !topo.pronta;
        return (
          <CamadaDaAtmosfera
            key={camada.id}
            camada={camada}
            visivel={visivel}
            chaveDePing={`${pathname}|${sinal}`}
            opacidade={opacidadeDaCamada(camada, tema)}
            aoPronta={() => marcar(camada.id, { pronta: true })}
            aoFalhar={() => marcar(camada.id, { falhou: true })}
          />
        );
      })}
    </>
  );
}

function opacidadeDaCamada(camada: Camada, tema: "dark" | "light"): number {
  const mostraPoster = camada.estilo === "poster" || camada.falhou;
  // O ASCII animado aplica o próprio teto no shader; o pôster dele usa o mesmo número.
  if (camada.linguagem === "ascii") return mostraPoster ? OPACIDADE_ATMOSFERA[tema] : 1;
  return TETO_DA_CAMADA[camada.modo === "imersivo" ? "apresentacao" : "plataforma"][tema];
}

function CamadaDaAtmosfera({ camada, visivel, chaveDePing, opacidade, aoPronta, aoFalhar }: {
  camada: Camada;
  visivel: boolean;
  /** Muda a cada evento que merece um ping: troca de página, seleção no grafo. */
  chaveDePing: string;
  opacidade: number;
  aoPronta: () => void;
  aoFalhar: () => void;
}) {
  const linguagem = camada.linguagem as Linguagem;
  const mostraPoster = camada.estilo === "poster" || camada.falhou;
  // Callbacks estáveis por camada: a cena não remonta a cada render do pai.
  const pronta = useRef(aoPronta);
  pronta.current = aoPronta;
  const falhar = useRef(aoFalhar);
  falhar.current = aoFalhar;
  const avisarPronta = useCallback(() => pronta.current(), []);
  const avisarFalha = useCallback(() => falhar.current(), []);

  return (
    <div
      aria-hidden="true"
      className="atmosfera-camada"
      data-linguagem={linguagem}
      data-estilo={mostraPoster ? "poster" : "animada"}
      data-visivel={visivel}
      style={{ "--atmosfera-teto": opacidade } as CSSProperties}
    >
      <Suspense fallback={null}>
        {mostraPoster ? (
          <Poster linguagem={linguagem} aoPronta={avisarPronta} />
        ) : linguagem === "ascii" ? (
          <CenaAscii aoPronta={avisarPronta} aoFalhar={avisarFalha} />
        ) : (
          <Cena3d linguagem={linguagem} modo={camada.modo} chaveDePing={chaveDePing} aoPronta={avisarPronta} aoFalhar={avisarFalha} />
        )}
      </Suspense>
    </div>
  );
}
