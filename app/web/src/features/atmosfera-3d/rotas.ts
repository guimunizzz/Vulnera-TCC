/**
 * features/atmosfera-3d/rotas.ts
 *
 * O QUE FAZ
 * Diz qual atmosfera cada tela da área autenticada usa. Cada linguagem tem um
 * papel, e é o papel que decide a tela (D20.2, D21.1):
 *
 *   nebulosa  o todo — a visão geral da empresa ............ Dashboard
 *   relevo    vigilância da superfície de risco (radar) .... Aplicações,
 *             Projetos, Threat Intel, Remediação (o relevo baixa quando o
 *             risco cai, a metáfora do ato 4 da landing) e Exposure Graph
 *             (o fundo acompanha o grafo; some na aba do mapa 3D)
 *   ascii     trabalho técnico cru (terminal, evidência) ... Findings, DAST,
 *             SAST/SCA, Playbooks, Agendamentos, Nova análise
 *   ascii     PARADO (pôster, sem movimento) — formulário e configuração,
 *             onde o foco é preencher: SLA, Aprovações, Filas, Maturidade
 *
 * Rota não listada fica com o ASCII animado, o fundo histórico.
 *
 * QUEM USA
 * `atmosfera-da-plataforma.tsx`. Não importa three: roda no bundle principal.
 */

export type Linguagem = "nebulosa" | "relevo" | "ascii";

export interface AtmosferaDaRota {
  linguagem: Linguagem;
  /** Quadro parado (pôster) mesmo quando a cena poderia animar. */
  parada: boolean;
}

const animada = (linguagem: Linguagem): AtmosferaDaRota => ({ linguagem, parada: false });

/** A primeira regra que casa vence: as mais específicas vêm antes. */
const REGRAS: Array<[RegExp, AtmosferaDaRota]> = [
  // Criar finding mora sob /projects, mas é trabalho técnico.
  [/^\/projects\/[^/]+\/findings(\/|$)/, animada("ascii")],
  [/^\/dashboard\/?$/, animada("nebulosa")],
  [/^\/(applications|projects|threat-intel|remediation|exposure-graph)(\/|$)/, animada("relevo")],
  [/^\/(findings|dast|sast-sca|playbooks|agendamentos|new-analysis)(\/|$)/, animada("ascii")],
  [/^\/(settings|admin)(\/|$)/, { linguagem: "ascii", parada: true }],
  [/^\/companies\/[^/]+\/maturity(\/|$)/, { linguagem: "ascii", parada: true }],
];

export function atmosferaDaRota(caminho: string): AtmosferaDaRota {
  for (const [regra, atmosfera] of REGRAS) {
    if (regra.test(caminho)) return atmosfera;
  }
  return animada("ascii");
}
