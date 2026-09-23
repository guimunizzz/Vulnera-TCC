/**
 * risk-context-chips.tsx
 *
 * O QUE FAZ
 * Mostra o contexto de risco de uma aplicação (CP-1) como uma linha de chips
 * compactos: criticidade, ambiente, exposição à internet e sensibilidade do
 * dado. É a mesma peça em três lugares — tabela de aplicações, cabeçalho do
 * painel da aplicação e detalhe do finding — para o contexto ter sempre a
 * mesma cara.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - Cada chip é TEXTO ("Crítica", "Exposta à internet"), nunca só cor. O
 *     tom do badge é reforço para quem enxerga; o rótulo carrega o sentido.
 *   - O grupo tem `aria-label` nomeando o que é, e cada chip leva um `title`
 *     com a dimensão por extenso ("Criticidade: Crítica") para quem passa o
 *     ponteiro ou navega por leitor de tela e quer saber a que o valor se refere.
 *
 * QUEM USA
 * `pages/applications-page.tsx`, `pages/application-dashboard-page.tsx`,
 * `pages/finding-detail-page.tsx`.
 */

import { Badge, type TomBadge } from "../ui/badge";
import {
  CRITICALITY_LABELS,
  DATA_SENSITIVITY_LABELS,
  ENVIRONMENT_LABELS,
  type ApplicationRiskContext,
  type Criticality,
  type DataSensitivity,
  type Environment,
} from "../../types/application.types";

/** Quanto mais alto o risco da dimensão, mais forte o tom. */
const TOM_CRITICIDADE: Record<string, TomBadge> = {
  LOW: "neutro",
  MEDIUM: "neutro",
  HIGH: "atencao",
  CRITICAL: "perigo",
};
const TOM_SENSIBILIDADE: Record<string, TomBadge> = {
  PUBLIC: "neutro",
  INTERNAL: "neutro",
  CONFIDENTIAL: "atencao",
  RESTRICTED: "perigo",
};

export interface RiskContextChipsProps {
  contexto: ApplicationRiskContext;
  /** Compacto: só os chips; sem ele, cada chip vem precedido do nome da dimensão. */
  compacto?: boolean;
  className?: string;
}

export function RiskContextChips({ contexto, compacto = true, className }: RiskContextChipsProps) {
  const criticidade = CRITICALITY_LABELS[contexto.criticality as Criticality] ?? contexto.criticality;
  const ambiente = ENVIRONMENT_LABELS[contexto.environment as Environment] ?? contexto.environment;
  const sensibilidade = DATA_SENSITIVITY_LABELS[contexto.dataSensitivity as DataSensitivity] ?? contexto.dataSensitivity;

  const prefixo = (nome: string) => (compacto ? "" : `${nome}: `);

  return (
    <div
      role="group"
      aria-label="Contexto de risco da aplicação"
      className={["flex flex-wrap items-center gap-1.5", className].filter(Boolean).join(" ")}
    >
      <Badge tom={TOM_CRITICIDADE[contexto.criticality] ?? "neutro"} className="whitespace-nowrap">
        <span title={`Criticidade: ${criticidade}`}>
          {prefixo("Criticidade")}
          {criticidade}
        </span>
      </Badge>
      <Badge tom={contexto.environment === "PROD" ? "acento" : "neutro"} className="whitespace-nowrap">
        <span title={`Ambiente: ${ambiente}`}>
          {prefixo("Ambiente")}
          {ambiente}
        </span>
      </Badge>
      <Badge tom={contexto.internetFacing ? "atencao" : "neutro"} className="whitespace-nowrap">
        <span title={contexto.internetFacing ? "Exposta à internet" : "Não exposta à internet"}>
          {contexto.internetFacing ? "Exposta à internet" : "Interna"}
        </span>
      </Badge>
      <Badge tom={TOM_SENSIBILIDADE[contexto.dataSensitivity] ?? "neutro"} className="whitespace-nowrap">
        <span title={`Sensibilidade do dado: ${sensibilidade}`}>
          {prefixo("Dado")}
          {sensibilidade}
        </span>
      </Badge>
    </div>
  );
}
