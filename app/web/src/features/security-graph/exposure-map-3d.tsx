/**
 * exposure-map-3d.tsx
 *
 * O QUE FAZ
 * Mapa 3D da superfície de ataque da empresa: bairros por ambiente, um prédio
 * por aplicação (altura = abertas, base = criticidade, cor = pior severidade,
 * antena = exposta à Internet). Clique num prédio seleciona a aplicação (a
 * mesma seleção do grafo 2D e do painel); arrastar gira, roda aproxima.
 *
 * POR QUE EXISTE
 * É a visão de apresentação da empresa: a forma da cidade já conta onde está
 * o risco antes de qualquer número. Substitui o antigo Security Graph 3D do
 * scan (ADR-050), que repetia o 2D com menos legibilidade. Cada eixo visual é
 * um campo real; nada é decorativo a ponto de parecer dado.
 *
 * Acessibilidade: o canvas não é navegável por teclado, então a lista de
 * prédios abaixo dele (botões) faz o mesmo papel; o painel lateral mostra o
 * detalhe. Movimento reduzido desliga o pulso da antena e o voo da câmera.
 *
 * QUEM USA
 * `exposure-graph-page.tsx`, via React.lazy() — `three` só baixa nesta aba.
 */

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Grid, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "../../design/theme-provider";
import { useMotion } from "../../motion/use-motion";
import type { AplicacaoExposta, ExposureGraph, SeveridadeVuln } from "../../types/exposure-graph.types";
import { idDaAplicacao } from "./exposure-graph-model";
import { montarCidade, type Predio } from "./exposure-map-layout";
import { ROTULO_RISCO } from "./node-visual";

/** Cor sRGB de um token OKLCH: materiais WebGL não leem CSS, então o canvas 2D converte. */
function corDoToken(token: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!valor || !ctx) return "#888888";
  ctx.fillStyle = `oklch(${valor})`;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

const TOKENS = {
  CRITICAL: "--color-severity-critical",
  HIGH: "--color-severity-high",
  MEDIUM: "--color-severity-medium",
  LOW: "--color-severity-low",
  // Prédio sem nada aberto: claro o bastante para não sumir no chão escuro.
  neutro: "--color-text-muted",
  chao: "--color-bg-inset",
  bairro: "--color-bg-surface",
  borda: "--color-border-default",
  acento: "--color-accent",
  fundo: "--color-bg-canvas",
} as const;
type Paleta = Record<keyof typeof TOKENS, string>;

function usePaleta(): Paleta {
  const { resolvido } = useTheme();
  // Recalcula na troca de tema (e de alto contraste, que também muda os tokens).
  const [contraste, setContraste] = useState(() => document.documentElement.hasAttribute("data-alto-contraste"));
  useEffect(() => {
    const obs = new MutationObserver(() => setContraste(document.documentElement.hasAttribute("data-alto-contraste")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-alto-contraste"] });
    return () => obs.disconnect();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tema e contraste mudam os valores dos tokens lidos do DOM
  return useMemo(() => Object.fromEntries(Object.entries(TOKENS).map(([k, t]) => [k, corDoToken(t)])) as Paleta, [resolvido, contraste]);
}

const corDaApp = (p: Paleta, sev: SeveridadeVuln | null) => (sev ? p[sev] : p.neutro);

function Antena({ altura, cor, pulsar }: { altura: number; cor: string; pulsar: boolean }) {
  const anel = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!anel.current || !pulsar) return;
    const t = (clock.getElapsedTime() % 2) / 2;
    anel.current.scale.setScalar(1 + t * 1.6);
    (anel.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });
  return (
    <group position={[0, altura, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={anel} position={[0, 0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.3, 32]} />
        <meshBasicMaterial color={cor} transparent opacity={pulsar ? 0.7 : 0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function PredioMesh({
  predio,
  paleta,
  selecionado,
  apagado,
  pulsar,
  aoSelecionar,
}: {
  predio: Predio;
  paleta: Paleta;
  selecionado: boolean;
  apagado: boolean;
  pulsar: boolean;
  aoSelecionar(id: string): void;
}) {
  const [hover, setHover] = useState(false);
  const cor = corDaApp(paleta, predio.app.piorSeveridade);
  return (
    <group position={[predio.x, 0, predio.z]}>
      <mesh
        position={[0, predio.altura / 2, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          aoSelecionar(idDaAplicacao(predio.app.id));
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <boxGeometry args={[predio.base, predio.altura, predio.base]} />
        <meshStandardMaterial
          color={cor}
          roughness={0.55}
          metalness={0.1}
          transparent
          opacity={apagado ? 0.25 : 0.92}
          emissive={cor}
          emissiveIntensity={selecionado ? 0.45 : hover ? 0.25 : 0.06}
        />
        {(selecionado || hover) && <Edges color={paleta.acento} lineWidth={selecionado ? 2.5 : 1.5} />}
      </mesh>
      {predio.app.internetFacing && <Antena altura={predio.altura} cor={paleta.acento} pulsar={pulsar && !apagado} />}
      <Html position={[0, predio.altura + (predio.app.internetFacing ? 1.35 : 0.35), 0]} center distanceFactor={14} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="whitespace-nowrap rounded-control border border-subtle bg-surface/90 px-1.5 py-0.5 text-[11px] font-semibold text-fg shadow-raised"
          style={{ opacity: apagado ? 0.35 : 1 }}
        >
          {predio.app.name}
          <span className="ml-1 font-mono font-normal text-fg-muted">{predio.app.totalAbertas}</span>
        </div>
      </Html>
    </group>
  );
}

/** Leva o alvo da órbita até o prédio selecionado (salto direto com movimento reduzido). */
function FocoDaCamera({ alvo, reduzido }: { alvo: THREE.Vector3 | null; reduzido: boolean }) {
  // `makeDefault` no OrbitControls publica os controles aqui.
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const destino = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    destino.current = alvo;
    if (alvo && reduzido && controls) {
      controls.target.copy(alvo);
      controls.update();
    }
  }, [alvo, reduzido, controls]);
  useFrame(() => {
    if (!controls || !destino.current || reduzido) return;
    controls.target.lerp(destino.current, 0.08);
    if (controls.target.distanceTo(destino.current) < 0.01) destino.current = null;
    controls.update();
  });
  return null;
}

class LimiteDeErro extends Component<{ children: ReactNode; fallback: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  render() {
    return this.state.falhou ? this.props.fallback : this.props.children;
  }
}

const TEM_WEBGL = typeof window !== "undefined" && "WebGL2RenderingContext" in window;

export default function ExposureMap3D({
  dados,
  selecionadoId,
  aoSelecionar,
}: {
  dados: ExposureGraph;
  selecionadoId: string | null;
  aoSelecionar(id: string | null): void;
}) {
  const paleta = usePaleta();
  const { reduzido } = useMotion();
  const cidade = useMemo(() => montarCidade(dados.aplicacoes), [dados.aplicacoes]);
  const predios = cidade.bairros.flatMap((b) => b.predios);
  const selecionado = predios.find((p) => idDaAplicacao(p.app.id) === selecionadoId);
  const alvo = useMemo(() => (selecionado ? new THREE.Vector3(selecionado.x, selecionado.altura / 2, selecionado.z) : null), [selecionado]);
  const raio = Math.max(cidade.largura, cidade.profundidade, 8);
  const expostas = dados.aplicacoes.filter((a) => a.internetFacing).length;

  const semCena = (
    <div role="status" className="flex h-[34rem] items-center justify-center p-6 text-center text-sm text-fg-muted">
      Este navegador não conseguiu iniciar o WebGL. O grafo 2D e a lista abaixo mostram os mesmos dados.
    </div>
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="relative overflow-hidden rounded-container border border-subtle" style={{ background: paleta.fundo }}>
        {TEM_WEBGL ? (
          <LimiteDeErro fallback={semCena}>
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [raio * 0.5, raio * 0.58, raio * 0.85], fov: 45 }}
              gl={{ antialias: true, preserveDrawingBuffer: true }}
              className="!h-[34rem]"
              aria-label={`Mapa 3D da superfície de ataque: ${dados.aplicacoes.length} aplicações em ${cidade.bairros.length} ambientes, ${expostas} expostas à Internet.`}
              role="img"
              onPointerMissed={() => aoSelecionar(null)}
            >
              <ambientLight intensity={0.55} />
              <directionalLight position={[raio, raio * 1.4, raio * 0.6]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
              <hemisphereLight args={[paleta.acento, paleta.chao, 0.25]} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
                <planeGeometry args={[raio * 4, raio * 4]} />
                <meshStandardMaterial color={paleta.chao} roughness={1} />
              </mesh>
              {/* Grade de referência que some na distância: dá escala sem competir com os prédios. */}
              <Grid
                position={[0, 0.001, 0]}
                args={[raio * 4, raio * 4]}
                cellSize={1}
                cellThickness={0.6}
                cellColor={paleta.borda}
                sectionSize={5}
                sectionThickness={1}
                sectionColor={paleta.borda}
                fadeDistance={raio * 2.2}
                fadeStrength={1.5}
                infiniteGrid
              />
              {cidade.bairros.map((b) => (
                <group key={b.ambiente}>
                  <mesh position={[b.x, 0.03, b.z]} receiveShadow>
                    <boxGeometry args={[b.largura, 0.06, b.profundidade]} />
                    <meshStandardMaterial color={paleta.bairro} roughness={0.9} />
                    <Edges color={paleta.borda} />
                  </mesh>
                  <Html position={[b.x - b.largura / 2 + 0.3, 0.1, b.z + b.profundidade / 2 + 0.6]} distanceFactor={16} style={{ pointerEvents: "none" }}>
                    <div className="whitespace-nowrap font-mono text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">{b.rotulo}</div>
                  </Html>
                </group>
              ))}
              {predios.map((p) => (
                <PredioMesh
                  key={p.app.id}
                  predio={p}
                  paleta={paleta}
                  selecionado={p === selecionado}
                  apagado={!!selecionado && p !== selecionado}
                  pulsar={!reduzido}
                  aoSelecionar={aoSelecionar}
                />
              ))}
              <OrbitControls makeDefault enableDamping={!reduzido} maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={raio * 3} />
              <FocoDaCamera alvo={alvo} reduzido={reduzido} />
            </Canvas>
          </LimiteDeErro>
        ) : (
          semCena
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-surface/85 px-3 py-2 text-xs text-fg-muted backdrop-blur">
          <span>Altura: abertas</span>
          <span>Base: criticidade</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: paleta.acento }} />
            Antena: exposta à Internet
          </span>
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: paleta[s] }} />
              {ROTULO_RISCO[s]}
            </span>
          ))}
        </div>
      </div>
      <ListaDePredios aplicacoes={dados.aplicacoes} selecionadoId={selecionadoId} aoSelecionar={aoSelecionar} />
    </div>
  );
}

/** O mesmo conteúdo do mapa, navegável por teclado e leitor de tela. */
function ListaDePredios({
  aplicacoes,
  selecionadoId,
  aoSelecionar,
}: {
  aplicacoes: AplicacaoExposta[];
  selecionadoId: string | null;
  aoSelecionar(id: string): void;
}) {
  return (
    <ul aria-label="Aplicações no mapa" className="flex flex-wrap gap-1.5">
      {aplicacoes.map((a) => {
        const id = idDaAplicacao(a.id);
        return (
          <li key={a.id}>
            <button
              type="button"
              aria-pressed={selecionadoId === id}
              onClick={() => aoSelecionar(id)}
              className="alvo-estendido flex items-center gap-1.5 rounded-full border border-subtle px-2.5 py-1 text-xs text-fg transition-colors hover:bg-inset aria-pressed:border-accent aria-pressed:bg-accent/10"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `oklch(var(${a.piorSeveridade ? TOKENS[a.piorSeveridade] : TOKENS.neutro}))` }}
                aria-hidden="true"
              />
              {a.name}
              <span className="font-mono text-fg-muted" data-numeric>
                {a.totalAbertas}
              </span>
              {a.internetFacing && <span className="sr-only">, exposta à Internet</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
