/**
 * lab-3d-page.tsx
 *
 * O QUE FAZ
 * Laboratório de atmosferas 3D: as linhas visuais escolhidas (relevo e
 * nebulosa, as duas com radar e pings) em tela cheia, nos modos plataforma
 * (fundo calmo atrás do conteúdo) e imersivo (tela própria), com troca de
 * tema, controle de "risco" e cartões de exemplo por cima para julgar a leitura.
 *
 * POR QUE EXISTE
 * Escolher a direção visual do fundo do produto e de uma tela imersiva antes
 * de mexer em tela real. Os cartões são texto de exemplo, rotulados como
 * tal: nada aqui é dado do produto.
 *
 * ⚠️ SÓ EM DESENVOLVIMENTO, como o styleguide: a rota existe sob
 * `import.meta.env.DEV` no `App.tsx` e some do build de produção.
 */

import { useCallback, useRef, useState } from "react";
import { Button, Card, SeverityBadge, Slider } from "../components/ui";
import { useCenaPermitida } from "../three/gate";
import { CATALOGO_3D } from "../features/atmosfera-3d/variantes";
import { useCena3d } from "../features/atmosfera-3d/use-cena-3d";
import { RISCO_NEUTRO, TETO_DA_CAMADA } from "../features/atmosfera-3d/config";
import { useAtmosferaStore, usePublicarRisco } from "../features/atmosfera-3d/risco";
import PosterDaAtmosfera from "../features/atmosfera-3d/poster-da-atmosfera";
import type { Linguagem } from "../features/atmosfera-3d/rotas";
import type { FabricaDeVariante, ModoDaVariante, TemaDaVariante } from "../features/atmosfera-3d/tipos";

/** A mesma opacidade de camada que o produto usa: a prévia é fiel. */
const tetoDo = (modo: ModoDaVariante, tema: TemaDaVariante) => TETO_DA_CAMADA[modo === "imersivo" ? "apresentacao" : "plataforma"][tema];

function CenaDoLab({ fabrica, tema, modo, raizRef, aoMedir, aoFalhar }: {
  fabrica: FabricaDeVariante;
  tema: TemaDaVariante;
  modo: ModoDaVariante;
  raizRef: React.RefObject<HTMLElement>;
  aoMedir: (fps: number) => void;
  aoFalhar: () => void;
}) {
  const palcoRef = useRef<HTMLDivElement>(null);
  // O risco do slider passa pelo mesmo store que as telas usam.
  const obterRisco = useCallback(() => useAtmosferaStore.getState().risco ?? RISCO_NEUTRO, []);
  useCena3d(palcoRef, { fabrica, tema, modo, raiz: raizRef, obterRisco, aoMedir, aoFalhar });
  return <div ref={palcoRef} className="absolute inset-0" style={{ opacity: tetoDo(modo, tema) }} />;
}

function CartoesDeExemplo() {
  return (
    <div className="pointer-events-auto mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
      <Card titulo="Vulnerabilidades abertas" descricao="Texto de exemplo para julgar a leitura">
        <p className="font-mono text-3xl tabular-nums">128</p>
        <p className="text-sm text-fg-muted">+12 nos últimos 7 dias</p>
      </Card>
      <Card titulo="Mais graves" descricao="Exemplo">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between gap-2"><span>SQL Injection em /login</span><SeverityBadge severidade="CRITICAL" cvss={9.8} /></li>
          <li className="flex items-center justify-between gap-2"><span>XSS refletido na busca</span><SeverityBadge severidade="HIGH" cvss={7.4} /></li>
          <li className="flex items-center justify-between gap-2"><span>Cabeçalho CSP ausente</span><SeverityBadge severidade="MEDIUM" cvss={5.3} /></li>
        </ul>
      </Card>
      <Card titulo="SLA" descricao="Exemplo">
        <p className="text-sm text-fg-muted">Três prazos vencem esta semana. Texto secundário longo o suficiente para quebrar em duas linhas e mostrar o contraste com o fundo.</p>
      </Card>
    </div>
  );
}

export function Lab3dPage() {
  const raizRef = useRef<HTMLDivElement>(null);
  const permitida = useCenaPermitida();
  const [indice, setIndice] = useState(0);
  const [tema, setTema] = useState<TemaDaVariante>("dark");
  const [modo, setModo] = useState<ModoDaVariante>("plataforma");
  const [risco, setRisco] = useState(35);
  const [cartoes, setCartoes] = useState(true);
  const [fps, setFps] = useState<number | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [poster, setPoster] = useState(false);
  const atual = CATALOGO_3D[indice];
  usePublicarRisco(risco / 100);

  return (
    <div ref={raizRef} data-theme={tema} className="relative h-dvh w-full overflow-hidden bg-canvas text-fg">
      {poster && (
        <div className="absolute inset-0" style={{ opacity: tetoDo(modo, tema) }}>
          {/* key: o pôster ouve o tema do documento; aqui o tema é do contêiner. */}
          <PosterDaAtmosfera key={tema} linguagem={atual.id as Linguagem} aoPronta={() => undefined} />
        </div>
      )}
      {!poster && permitida && !falhou && (
        <CenaDoLab
          key={`${atual.id}-${tema}-${modo}`}
          fabrica={atual.fabrica}
          tema={tema}
          modo={modo}
          raizRef={raizRef}
          aoMedir={setFps}
          aoFalhar={() => setFalhou(true)}
        />
      )}

      <div className="pointer-events-none relative z-10 flex h-full flex-col gap-6 p-6">
        <header className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-lg border bg-surface/80 p-3 backdrop-blur">
          <h1 className="mr-2 text-lg font-semibold">Laboratório 3D</h1>
          {CATALOGO_3D.map((item, i) => (
            <Button key={item.id} size="sm" variant={i === indice ? "primario" : "secundario"} onClick={() => setIndice(i)}>
              {item.nome}
            </Button>
          ))}
          <span className="mx-1 h-6 border-l border-strong" aria-hidden="true" />
          <Button size="sm" variant="fantasma" onClick={() => setModo(modo === "plataforma" ? "imersivo" : "plataforma")}>
            Modo: {modo}
          </Button>
          <Button size="sm" variant="fantasma" onClick={() => setTema(tema === "dark" ? "light" : "dark")}>
            Tema: {tema === "dark" ? "escuro" : "claro"}
          </Button>
          <Button size="sm" variant={poster ? "primario" : "fantasma"} onClick={() => setPoster(!poster)}>
            Pôster
          </Button>
          <Button size="sm" variant={cartoes ? "primario" : "fantasma"} onClick={() => setCartoes(!cartoes)}>
            Cartões por cima
          </Button>
          <label className="flex min-w-[14rem] items-center gap-2 text-sm">
            Risco
            <Slider min={0} max={100} value={risco} onChange={(e) => setRisco(Number(e.target.value))} mostrarValor aria-label="Risco expresso pela cena" />
          </label>
          <span className="ml-auto font-mono text-sm tabular-nums text-fg-muted">{fps === null ? "— fps" : `${fps} fps`}</span>
        </header>

        <div className="flex flex-1 items-center">{cartoes && <CartoesDeExemplo />}</div>

        <footer className="pointer-events-auto max-w-xl rounded-lg border bg-surface/80 p-3 text-sm backdrop-blur">
          <p className="font-medium">{atual.nome}</p>
          <p className="text-fg-muted">{atual.descricao}</p>
          <p className="mt-1 text-fg-muted">
            {modo === "plataforma"
              ? "Plataforma: fundo calmo atrás do conteúdo, sem bloom e mais leve."
              : "Imersivo: intensidade cheia com bloom. Clique no fundo para disparar um ping."}
          </p>
          {!permitida && <p className="mt-2 text-warning-ink">Cena desligada: movimento reduzido, alto contraste, tela estreita ou sem WebGL2.</p>}
          {falhou && <p className="mt-2 text-warning-ink">O WebGL falhou ou perdeu o contexto.</p>}
        </footer>
      </div>
    </div>
  );
}
