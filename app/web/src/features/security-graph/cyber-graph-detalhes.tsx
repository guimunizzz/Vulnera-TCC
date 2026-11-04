/**
 * cyber-graph-detalhes.tsx
 *
 * O QUE FAZ
 * O que o CyberGraph mostra sobre o nó selecionado: o painel lateral resumido
 * (tipo, severidade, caminho de exposição em linha do tempo) e o modal com tudo
 * o que o scan sabe do nó (descrição, solução, evidência, findings abaixo dele).
 * Os dois usam o ícone e a cor do nó no grafo, para a ligação ser imediata.
 *
 * POR QUE EXISTE
 * O 2D e o 3D compartilham a mesma seleção; o detalhe não depende do modo.
 * O modal é só leitura: triagem e promoção continuam na aba Achados, com as
 * permissões que já existem lá.
 *
 * QUEM USA
 * `cyber-graph.tsx`.
 */

import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  Braces,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Code2,
  ExternalLink,
  FileText,
  Gauge,
  Hash,
  Link2,
  ListChecks,
  Maximize2,
  Radar,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, SeverityBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogClose, DialogFooter, DialogTitle } from "../../components/ui/dialog";
import { useMotion } from "../../motion/use-motion";
import {
  DAST_RISK_LABELS,
  DAST_SENSOR_LABELS,
  DAST_TRIAGE_LABELS,
  DAST_TRIAGE_TONES,
  severidadeCvss,
  type DastFinding,
  type DastRisk,
} from "../../types/dast.types";
import type { DetalheDoNo } from "./node-detail";
import { cor, ICONE_DO_TIPO, ROTULO_TIPO, tokenDoNo } from "./node-visual";

const RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW", "INFO"];
/** O SeverityBadge usa o vocabulário de Vulnerability; INFO do ZAP é o NONE de lá. */
const SEVERIDADE_DO_RISCO: Record<DastRisk, string> = { HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", INFO: "NONE" };

function contarPorRisco(findings: DastFinding[]): Record<DastRisk, number> {
  const contagem: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) contagem[f.risk] += 1;
  return contagem;
}

/** Um bloco por risco, com a borda superior na cor da severidade. */
function ContagemPorRisco({ findings, compacta }: { findings: DastFinding[]; compacta?: boolean }) {
  const contagem = contarPorRisco(findings);
  return (
    <ul className={`grid gap-2 ${compacta ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`} aria-label="Findings por risco">
      {RISCOS.map((r) => {
        const token = tokenDoNo({ kind: "FINDING", risk: r });
        return (
          <li
            key={r}
            className="rounded-control border border-subtle bg-inset/60 px-3 py-2"
            style={{ borderTopColor: cor(token), borderTopWidth: 2, opacity: contagem[r] ? 1 : 0.5 }}
          >
            <span className="block text-[11px] font-medium uppercase tracking-wide text-fg-muted">{DAST_RISK_LABELS[r]}</span>
            <span className="font-mono text-lg font-semibold text-fg" data-numeric>
              {contagem[r]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const plural = (n: number, singular: string, pluralForma = `${singular}s`) => `${n} ${n === 1 ? singular : pluralForma}`;

function resumo(detalhe: DetalheDoNo, targetUrl: string): string {
  const meta = detalhe.asset?.metadata ?? {};
  switch (detalhe.kind) {
    case "INTERNET":
      return "Ponto de partida do scan: tudo à direita foi alcançado a partir da rede, sem acesso interno.";
    case "ASSET":
      return `Alvo do scan (${targetUrl}). ${plural(detalhe.endpoints, "endpoint")} com findings.`;
    case "ENDPOINT":
      return `${plural(detalhe.findings.length, "finding")} observado${detalhe.findings.length === 1 ? "" : "s"} neste endpoint.`;
    case "GROUP":
      return detalhe.ramo === "IP"
        ? `${plural(detalhe.findings.length, "CVE potencial", "CVEs potenciais")} associada${detalhe.findings.length === 1 ? "" : "s"} a este IP pela InternetDB (Shodan), com CVSS do NVD (NIST). Nenhuma foi testada no alvo.`
        : `${plural(detalhe.findings.length, "finding")} observado${detalhe.findings.length === 1 ? "" : "s"} neste endpoint.`;
    case "IP": {
      if (meta.publico === false)
        return "IP privado ou local: a InternetDB só conhece IPs públicos, então portas e CVEs não foram consultadas. O restante do scan rodou normalmente.";
      const portas = detalhe.estrutura.filter((e) => e.kind === "PORT").length;
      return `IP público do alvo. A InternetDB (Shodan) registra ${plural(portas, "porta aberta", "portas abertas")} e ${plural(detalhe.findings.length, "CVE potencial", "CVEs potenciais")} para ele. O Vulnera não se conectou a essas portas.`;
    }
    case "PORT":
      return `Porta ${detalhe.label.replace("porta ", "")} aberta em ${detalhe.asset?.parentValue ?? "?"}, vista publicamente pela Shodan. O Vulnera não se conectou a ela.`;
    case "TECH":
      return `${detalhe.label}, identificada por ${String(meta.fonte ?? "observação passiva")}.${meta.cpe ? ` CPE ${String(meta.cpe)}.` : ""} Versão anunciada não confirma a versão instalada.`;
    case "SUBDOMAIN":
      return detalhe.asset
        ? `${detalhe.label} aparece em certificado público (Certificate Transparency). Não foi acessado: o escopo autorizado é só ${targetUrl}.`
        : `${plural(detalhe.estrutura.length, "subdomínio")} em certificados públicos (crt.sh). Nenhum foi acessado: o escopo autorizado é só ${targetUrl}.`;
    case "FINDING": {
      const texto = detalhe.finding?.description ?? "O ZAP não trouxe descrição para este alerta.";
      return texto.length > 220 ? `${texto.slice(0, 219)}…` : texto;
    }
  }
}

/** Nota CVSS em destaque: número grande na cor do risco, faixa oficial, versão, vetor e link para o NVD. */
function CvssCartao({ finding }: { finding: DastFinding }) {
  const nota = finding.cvssScore ?? null;
  const token = tokenDoNo({ kind: "FINDING", risk: finding.risk });
  return (
    <div
      className="flex items-center gap-3 rounded-control border border-subtle bg-inset/60 p-3"
      style={{ borderLeftColor: cor(token), borderLeftWidth: 3 }}
    >
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-control" style={{ background: cor(token, 0.14) }}>
        <span className="font-mono text-xl font-bold" style={{ color: cor(token) }} data-numeric>
          {nota !== null ? nota.toFixed(1) : "—"}
        </span>
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-fg">
          CVSS {finding.cvssVersion ?? ""} · {severidadeCvss(nota)}
        </p>
        <p className="break-all font-mono text-[11px] text-fg-muted">{finding.cvssVector ?? "Sem CVSS do NVD para esta CVE neste scan."}</p>
        <a
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          href={`https://nvd.nist.gov/vuln/detail/${finding.cveId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {finding.cveId} no NVD (NIST)
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/** O que o sensor de descoberta sabe do ativo (IP, porta, tecnologia, subdomínio). */
function FichasDoAtivo({ detalhe }: { detalhe: DetalheDoNo }) {
  const a = detalhe.asset;
  if (!a && detalhe.estrutura.length === 0) return null;
  const meta = a?.metadata ?? {};
  const hostnames = Array.isArray(meta.hostnames) ? (meta.hostnames as string[]) : [];
  const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {a && <Ficha icone={Radar} rotulo="Sensor de origem">{DAST_SENSOR_LABELS[a.sensorKey] ?? a.sensorKey}</Ficha>}
      {a?.parentValue && (
        <Ficha icone={Link2} rotulo="Ligado a">
          <span className="break-all font-mono text-xs">{a.parentValue}</span>
        </Ficha>
      )}
      {hostnames.length > 0 && (
        <Ficha icone={Hash} rotulo="Nomes reversos">
          <span className="break-all font-mono text-xs">{hostnames.slice(0, 5).join(", ")}</span>
        </Ficha>
      )}
      {tags.length > 0 && <Ficha icone={Tag} rotulo="Marcas da Shodan">{tags.join(", ")}</Ficha>}
      {detalhe.estrutura.length > 0 && (
        <div className="col-span-2">
          <Ficha icone={ListChecks} rotulo={detalhe.kind === "SUBDOMAIN" ? "Subdomínios" : "Portas e tecnologias"}>
            <span className="font-mono text-xs">{detalhe.estrutura.map((e) => e.label).join(" · ")}</span>
          </Ficha>
        </div>
      )}
    </dl>
  );
}

function Selos({ detalhe }: { detalhe: DetalheDoNo }) {
  const f = detalhe.finding;
  if (!detalhe.risk && !f) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {detalhe.risk && <SeverityBadge severidade={SEVERIDADE_DO_RISCO[detalhe.risk]} />}
      {f && <Badge tom={DAST_TRIAGE_TONES[f.triageStatus]}>{DAST_TRIAGE_LABELS[f.triageStatus]}</Badge>}
      {f?.cveId && <Badge tom="atencao">potencial · não validado</Badge>}
      {f?.promotedVulnerability && <Badge tom="acento">promovido</Badge>}
    </div>
  );
}

/** Ícone do nó num disco tingido com a cor dele: o mesmo símbolo que a pessoa clicou no grafo. */
function IconeDoNo({ detalhe, tamanho }: { detalhe: DetalheDoNo; tamanho: "md" | "lg" }) {
  const token = tokenDoNo(detalhe);
  const Icone = ICONE_DO_TIPO[detalhe.kind];
  const lado = tamanho === "lg" ? "h-12 w-12" : "h-10 w-10";
  return (
    <span
      aria-hidden="true"
      className={`grid ${lado} shrink-0 place-items-center rounded-full border-2`}
      style={{ borderColor: cor(token), background: cor(token, 0.14), boxShadow: `0 0 18px ${cor(token, 0.35)}` }}
    >
      <Icone className={tamanho === "lg" ? "h-6 w-6" : "h-5 w-5"} style={{ color: cor(token) }} strokeWidth={1.8} />
    </span>
  );
}

/** Ficha curta de metadado: ícone, rótulo e valor. */
function Ficha({ icone: Icone, rotulo, children }: { icone: LucideIcon; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-control border border-subtle bg-inset/60 px-3 py-2">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">{rotulo}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-fg">{children}</dd>
      </div>
    </div>
  );
}

const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR");

/* ------------------------------------------------------------------ painel */

export function PainelDoNo({
  detalhe,
  targetUrl,
  totalFindings,
  aoSelecionar,
  aoExpandir,
  aoVerNaLista,
  certificado,
}: {
  detalhe: DetalheDoNo | null;
  targetUrl: string;
  totalFindings: DastFinding[];
  aoSelecionar(id: string): void;
  aoExpandir(): void;
  aoVerNaLista(findingId: string): void;
  /** Resumo do sensor SSL/TLS (mostrado no nó do alvo). */
  certificado?: string | null;
}) {
  const { troca } = useMotion();
  const token = detalhe ? tokenDoNo(detalhe) : "--color-accent";
  const f = detalhe?.finding;

  return (
    <aside
      className="relative overflow-hidden rounded-container border bg-surface shadow-raised transition-colors duration-300"
      style={{ borderColor: cor(token, detalhe ? 0.5 : 0.2) }}
      aria-label="Detalhes do nó"
      aria-live="polite"
    >
      {/* Faixa na cor do nó: liga o painel ao que está selecionado no grafo. */}
      <div aria-hidden="true" className="h-1 transition-colors duration-300" style={{ background: cor(token, detalhe ? 1 : 0.3) }} />
      <motion.div key={detalhe?.id ?? "vazio"} variants={troca} initial="inicial" animate="visivel" className="flex flex-col gap-4 p-4">
        {!detalhe ? (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Nenhum nó selecionado</p>
              <p className="mt-2 text-sm text-fg-secondary">
                Clique num nó para ver o caminho de exposição dele. Duplo clique (ou{" "}
                <kbd className="rounded border border-subtle bg-inset px-1 font-mono text-xs">Shift+Enter</kbd>) abre os detalhes.
              </p>
            </div>
            <ContagemPorRisco findings={totalFindings} compacta />
            <p className="border-t border-subtle pt-3 text-xs text-fg-muted">
              Fontes: OWASP ZAP e os sensores passivos deste scan. IP, portas e CVEs vêm da InternetDB (Shodan) com CVSS do
              NVD (NIST); CVE é potencial até alguém confirmar a versão. Subdomínios (crt.sh) só são listados, nunca acessados.
            </p>
          </>
        ) : (
          <>
            <div
              className="-m-4 mb-0 flex items-start gap-3 p-4"
              style={{ background: `radial-gradient(120% 140% at 0% 0%, ${cor(token, 0.16)}, transparent 70%)` }}
            >
              <IconeDoNo detalhe={detalhe} tamanho="md" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: cor(token) }}>
                  {ROTULO_TIPO[detalhe.kind]}
                </p>
                <h3 className="mt-0.5 break-words text-lg font-semibold leading-snug text-fg">{detalhe.label}</h3>
                <div className="mt-2">
                  <Selos detalhe={detalhe} />
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-fg-secondary">{resumo(detalhe, targetUrl)}</p>
            {f?.cveId && <CvssCartao finding={f} />}
            <FichasDoAtivo detalhe={detalhe} />

            {f && (
              <dl className="grid grid-cols-2 gap-2">
                <Ficha icone={ShieldAlert} rotulo="CWE">{f.cweId ? `CWE-${f.cweId}` : "—"}</Ficha>
                <Ficha icone={Gauge} rotulo="Confiança">{f.confidence}</Ficha>
                <Ficha icone={Radar} rotulo="Sensor de origem">{DAST_SENSOR_LABELS[f.sensorKey] ?? f.sensorKey}</Ficha>
                <Ficha icone={CalendarClock} rotulo="Observado">{new Date(f.createdAt).toLocaleDateString("pt-BR")}</Ficha>
                <Ficha icone={Braces} rotulo="Parâmetro">
                  <span className="font-mono text-xs">{f.param ?? "—"}</span>
                </Ficha>
              </dl>
            )}
            {detalhe.url && (
              <dl>
                <Ficha icone={Link2} rotulo="URL">
                  <span className="break-all font-mono text-xs">{detalhe.url}</span>
                </Ficha>
              </dl>
            )}
            {detalhe.kind === "ASSET" && certificado && (
              <dl>
                <Ficha icone={ShieldCheck} rotulo="Certificado SSL/TLS">
                  <span className="text-xs">{certificado}</span>
                </Ficha>
              </dl>
            )}
            {!f && detalhe.findings.length > 0 && <ContagemPorRisco findings={detalhe.findings} compacta />}

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Caminho de exposição</p>
              {/* Linha do tempo: cada passo é um nó clicável, na cor dele no grafo. */}
              <ol className="relative mt-3 flex flex-col gap-1 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-[oklch(var(--color-border-default))]">
                {detalhe.caminho.map((passo) => {
                  const atual = passo.id === detalhe.id;
                  const tokenPasso = tokenDoNo({ kind: passo.kind, risk: atual ? detalhe.risk : undefined });
                  const Icone = ICONE_DO_TIPO[passo.kind];
                  return (
                    <li key={passo.id} className="relative">
                      <button
                        type="button"
                        onClick={() => aoSelecionar(passo.id)}
                        aria-current={atual ? "step" : undefined}
                        className="flex w-full items-center gap-3 rounded-control py-1 pr-2 text-left text-sm text-fg transition-colors hover:bg-hovered"
                      >
                        <span
                          aria-hidden="true"
                          className="relative grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-surface"
                          style={{ borderColor: cor(tokenPasso), boxShadow: atual ? `0 0 0 3px ${cor(tokenPasso, 0.25)}` : undefined }}
                        >
                          <Icone className="h-3.5 w-3.5" style={{ color: cor(tokenPasso) }} />
                        </span>
                        <span className={`truncate ${atual ? "font-semibold" : "text-fg-secondary"}`}>{passo.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-subtle pt-4">
              <Button size="sm" onClick={aoExpandir} iconeInicio={<Maximize2 className="h-4 w-4" aria-hidden="true" />}>
                Expandir detalhes
              </Button>
              {f && (
                <Button
                  size="sm"
                  variant="secundario"
                  onClick={() => aoVerNaLista(f.id)}
                  iconeInicio={<ListChecks className="h-4 w-4" aria-hidden="true" />}
                >
                  Triar em Achados
                </Button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </aside>
  );
}

/* ------------------------------------------------------------------- modal */

/** Só http(s) vira link: a referência vem do ZAP e não deve virar `javascript:`. */
function Referencias({ texto }: { texto: string }) {
  const linhas = texto.split(/\s+/).filter(Boolean);
  return (
    <ul className="flex flex-col gap-1.5">
      {linhas.map((linha, i) => (
        <li key={`${linha}-${i}`} className="break-all">
          {/^https?:\/\//i.test(linha) ? (
            <a
              href={linha}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-accent-ink underline-offset-2 hover:underline"
            >
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {linha}
            </a>
          ) : (
            linha
          )}
        </li>
      ))}
    </ul>
  );
}

/** Seção do modal: título com ícone e conteúdo num cartão; entra escalonada com as outras. */
function Secao({
  icone: Icone,
  titulo,
  children,
  destaque,
}: {
  icone: LucideIcon;
  titulo: string;
  children: ReactNode;
  /** Token da borda esquerda (ex.: solução em verde). */
  destaque?: string;
}) {
  const { item } = useMotion();
  return (
    <motion.section variants={item}>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <Icone className="h-4 w-4" aria-hidden="true" />
        {titulo}
      </h3>
      <div
        className="mt-2 rounded-control border border-subtle bg-surface/60 p-3 text-sm leading-relaxed text-fg"
        style={destaque ? { borderLeftColor: cor(destaque), borderLeftWidth: 3 } : undefined}
      >
        {children}
      </div>
    </motion.section>
  );
}

export function ModalDoNo({
  detalhe,
  aberto,
  targetUrl,
  aoFechar,
  aoSelecionar,
  aoVerNaLista,
  certificado,
}: {
  detalhe: DetalheDoNo | null;
  aberto: boolean;
  targetUrl: string;
  aoFechar(): void;
  aoSelecionar(id: string): void;
  aoVerNaLista(findingId: string): void;
  /** Resumo do sensor SSL/TLS (mostrado no nó do alvo). */
  certificado?: string | null;
}) {
  const { lista, item } = useMotion();
  const f = detalhe?.finding;
  const token = detalhe ? tokenDoNo(detalhe) : "--color-accent";

  return (
    // p-0: o padding vai para dentro, para a borda e o brilho na cor do nó irem até a margem.
    <Dialog aberto={aberto && !!detalhe} aoFechar={aoFechar} tamanho="lg" className="relative overflow-hidden border-0 p-0">
      {detalhe && (
        <div className="rounded-overlay border" style={{ borderColor: cor(token, 0.55), boxShadow: `0 0 40px -12px ${cor(token, 0.45)}` }}>
          <div aria-hidden="true" className="h-1" style={{ background: `linear-gradient(90deg, ${cor(token)}, ${cor(token, 0.15)})` }} />
          {/* Wrapper posicionado: a classe `press` do Button redefine `position`. */}
          <div className="absolute right-4 top-5 z-10">
            <DialogClose />
          </div>

          {/* A troca de nó dentro do modal (lista de findings → finding) reanima o conteúdo pela `key`. */}
          <motion.div key={detalhe.id} variants={lista} initial="inicial" animate="visivel">
            <motion.header
              variants={item}
              className="flex items-start gap-4 px-6 pb-4 pt-5"
              style={{ background: `radial-gradient(120% 160% at 0% 0%, ${cor(token, 0.18)}, transparent 65%)` }}
            >
              <IconeDoNo detalhe={detalhe} tamanho="lg" />
              <div className="min-w-0 pr-10">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: cor(token) }}>
                  {ROTULO_TIPO[detalhe.kind]}
                </p>
                <DialogTitle className="mt-0.5 break-words text-xl leading-snug">{detalhe.label}</DialogTitle>
                <div className="mt-2">
                  <Selos detalhe={detalhe} />
                </div>
              </div>
            </motion.header>

            <div className="max-h-[60vh] overflow-y-auto border-t border-subtle px-6 py-5">
              {f ? (
                <div className="flex flex-col gap-5">
                  {f.cveId && (
                    <motion.div variants={item}>
                      <CvssCartao finding={f} />
                    </motion.div>
                  )}
                  <motion.dl variants={item} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Ficha icone={ShieldAlert} rotulo="CWE">{f.cweId ? `CWE-${f.cweId}` : "—"}</Ficha>
                    <Ficha icone={Tag} rotulo="WASC">{f.wascId ?? "—"}</Ficha>
                    <Ficha icone={Gauge} rotulo={f.sensorKey === "zap" ? "Confiança do ZAP" : "Confiança"}>{f.confidence}</Ficha>
                    <Ficha icone={Radar} rotulo="Sensor de origem">{DAST_SENSOR_LABELS[f.sensorKey] ?? f.sensorKey}</Ficha>
                    <Ficha icone={Hash} rotulo={f.sensorKey === "zap" ? "Regra do ZAP" : "Regra do sensor"}>
                      <span className="font-mono text-xs">{f.pluginId}</span>
                    </Ficha>
                    <Ficha icone={Braces} rotulo="Parâmetro">
                      <span className="break-all font-mono text-xs">{f.param ?? "—"}</span>
                    </Ficha>
                    <Ficha icone={CalendarClock} rotulo="Observado em">{dataBr(f.createdAt)}</Ficha>
                  </motion.dl>

                  <Secao icone={Link2} titulo="URL">
                    <span className="break-all font-mono text-xs">{f.url}</span>
                  </Secao>
                  {f.description && (
                    <Secao icone={FileText} titulo="Descrição">
                      <span className="whitespace-pre-wrap">{f.description}</span>
                    </Secao>
                  )}
                  {f.solution && (
                    <Secao icone={Wrench} titulo="Solução" destaque="--color-success">
                      <span className="whitespace-pre-wrap">{f.solution}</span>
                    </Secao>
                  )}
                  {f.evidence && (
                    <Secao icone={Code2} titulo="Evidência">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-inset p-2 font-mono text-xs">{f.evidence}</pre>
                    </Secao>
                  )}
                  <Secao icone={ClipboardCheck} titulo="Triagem">
                    <span className="font-medium">{DAST_TRIAGE_LABELS[f.triageStatus]}</span>
                    {f.triagedByName && f.triagedAt && (
                      <span className="text-fg-secondary">{` · por ${f.triagedByName} em ${dataBr(f.triagedAt)}`}</span>
                    )}
                    {f.triageNote && <span className="mt-1 block whitespace-pre-wrap text-fg-secondary">{f.triageNote}</span>}
                    {f.promotedVulnerability && (
                      <span className="mt-1 block text-fg-secondary">
                        Promovido · severidade {f.promotedVulnerability.severityFinal}, situação {f.promotedVulnerability.status}
                      </span>
                    )}
                  </Secao>
                  {f.reference && (
                    <Secao icone={BookOpen} titulo="Referências">
                      <Referencias texto={f.reference} />
                    </Secao>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <motion.p variants={item} className="text-sm leading-relaxed text-fg-secondary">
                    {resumo(detalhe, targetUrl)}
                  </motion.p>
                  <motion.div variants={item}>
                    <FichasDoAtivo detalhe={detalhe} />
                  </motion.div>
                  {detalhe.url && (
                    <Secao icone={Link2} titulo="URL">
                      <span className="break-all font-mono text-xs">{detalhe.url}</span>
                    </Secao>
                  )}
                  {detalhe.kind === "ASSET" && certificado && (
                    <Secao icone={ShieldCheck} titulo="Certificado SSL/TLS">
                      {certificado}
                    </Secao>
                  )}
                  {detalhe.findings.length > 0 && (
                    <motion.div variants={item}>
                      <ContagemPorRisco findings={detalhe.findings} />
                    </motion.div>
                  )}
                  {detalhe.findings.length > 0 && (
                    <motion.div variants={item}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Findings ({detalhe.findings.length})</h3>
                      <ul className="mt-2 overflow-hidden rounded-control border border-subtle">
                        {detalhe.findings.map((finding) => (
                          <li key={finding.id} className="border-b border-subtle last:border-b-0">
                            <button
                              type="button"
                              onClick={() => aoSelecionar(`finding:${finding.id}`)}
                              className="group flex w-full items-center gap-3 border-l-[3px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-hovered"
                              style={{ borderLeftColor: cor(tokenDoNo({ kind: "FINDING", risk: finding.risk })) }}
                            >
                              <SeverityBadge severidade={SEVERIDADE_DO_RISCO[finding.risk]} className="shrink-0" />
                              <span className="min-w-0 flex-1 truncate text-fg">{finding.title}</span>
                              <span className="hidden max-w-[35%] truncate font-mono text-xs text-fg-muted sm:block">
                                {finding.normalizedUrl}
                              </span>
                              <ChevronRight
                                className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5"
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          <DialogFooter className="mt-0 border-t border-subtle bg-inset/40 px-6 py-4">
            <Button variant="secundario" onClick={aoFechar}>
              Fechar
            </Button>
            {f && (
              <Button onClick={() => aoVerNaLista(f.id)} iconeInicio={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
                Triar em Achados
              </Button>
            )}
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}
