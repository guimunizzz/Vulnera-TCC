/**
 * maturity-radar.tsx
 *
 * Radar de 7 eixos (um por domínio) com a média de cada um, escala fixa 0-5.
 * É o Recharts vivo da TELA — o PDF executivo usa uma versão desenhada à mão
 * com pdf-lib (lib/pdf/base.ts, drawRadarChart), porque o Recharts não
 * renderiza dentro de um PDF gerado no cliente.
 */

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { ACCENT_HEX } from "../../lib/severity-colors";

export interface MaturityRadarPoint {
  domain: string;
  average: number;
}

export function MaturityRadar({ data }: { data: MaturityRadarPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-fg-muted">Sem domínios respondidos suficientes para o gráfico.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#262626" />
          <PolarAngleAxis dataKey="domain" tick={{ fill: "#a3a3a3", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: "#737373", fontSize: 10 }} />
          <Radar dataKey="average" stroke={ACCENT_HEX} fill={ACCENT_HEX} fillOpacity={0.3} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
