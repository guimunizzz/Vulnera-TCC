/**
 * features/atmosfera-3d/rotas.ts
 *
 * O QUE FAZ
 * Diz qual atmosfera cada tela da área autenticada usa. Cada linguagem tem um
 * papel, e é o papel que decide a tela (decisão do Rafael, 2026-11-23):
 *
 *   nebulosa  o todo — a visão geral da empresa ............ Dashboard
 *   relevo    vigilância da superfície de risco (radar) .... Aplicações,
 *             Projetos, Threat Intel, Remediação (o relevo baixa quando o
 *             risco cai, a metáfora do ato 4 da landing)
 *   ascii     trabalho técnico cru (terminal, evidência) ... Findings, DAST,
 *             SAST/SCA, Playbooks, Agendamentos, Nova análise
 *   null      formulário e configuração, foco em preencher . Administração
 *             (SLA, Aprovações, Filas), Maturidade — e o Exposure Graph, que
 *             já tem o próprio mapa 3D
 *
 * Rota não listada fica com o ASCII, o fundo histórico da área autenticada.
 *
 * QUEM USA
 * `atmosfera-da-plataforma.tsx`. Não importa three: roda no bundle principal.
 */

export type Linguagem = "nebulosa" | "relevo" | "ascii";

/** A primeira regra que casa vence: as mais específicas vêm antes. */
const REGRAS: Array<[RegExp, Linguagem | null]> = [
  // Criar finding mora sob /projects, mas é trabalho técnico.
  [/^\/projects\/[^/]+\/findings(\/|$)/, "ascii"],
  [/^\/dashboard\/?$/, "nebulosa"],
  [/^\/(applications|projects|threat-intel|remediation)(\/|$)/, "relevo"],
  [/^\/(findings|dast|sast-sca|playbooks|agendamentos|new-analysis)(\/|$)/, "ascii"],
  [/^\/(settings|admin|exposure-graph)(\/|$)/, null],
  [/^\/companies\/[^/]+\/maturity(\/|$)/, null],
];

export function linguagemDaRota(caminho: string): Linguagem | null {
  for (const [regra, linguagem] of REGRAS) {
    if (regra.test(caminho)) return linguagem;
  }
  return "ascii";
}
