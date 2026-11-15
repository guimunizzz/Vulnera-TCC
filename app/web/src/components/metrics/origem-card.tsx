/**
 * origem-card.tsx
 *
 * Visão unificada da aplicação: os findings em aberto por lente — DAST (o app
 * rodando), SAST (o código), SCA (as dependências) e o registro manual — e,
 * para quem opera o módulo SAST/SCA, quantos achados de código ainda esperam
 * triagem. Barras proporcionais com o número sempre escrito ao lado: a cor
 * nunca carrega a informação sozinha.
 *
 * `filaDeTriagem` vem `null` para o CLIENT (a API não manda o que ele não vê),
 * e os links só aparecem com `comLinks` — o CLIENT não acessa Achados nem
 * SAST/SCA (ProtectedRoute + RBAC da API).
 */

import { Link } from "react-router-dom";
import { Card, Skeleton } from "../ui";
import { OrigemBadge } from "../findings/origem-badge";
import { SOURCE_TYPES, SOURCE_TYPE_DESCRICOES } from "../../types/vulnerability.types";

interface Props {
  applicationId: string;
  abertosPorOrigem: Record<string, number> | undefined;
  filaDeTriagem: Record<string, number> | null | undefined;
  carregando: boolean;
  comLinks: boolean;
}

export function OrigemCard({ applicationId, abertosPorOrigem, filaDeTriagem, carregando, comLinks }: Props) {
  const total = SOURCE_TYPES.reduce((soma, o) => soma + (abertosPorOrigem?.[o] ?? 0), 0);
  const maior = Math.max(1, ...SOURCE_TYPES.map((o) => abertosPorOrigem?.[o] ?? 0));
  const fila = filaDeTriagem ? (filaDeTriagem.SAST ?? 0) + (filaDeTriagem.SCA ?? 0) : 0;

  return (
    <Card titulo="Por origem" descricao="Findings em aberto no recorte, por lente: o app rodando (DAST), o código (SAST), as dependências (SCA) ou registro manual.">
      {carregando || !abertosPorOrigem ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3" aria-label="Findings em aberto por origem">
            {SOURCE_TYPES.map((o) => {
              const n = abertosPorOrigem[o] ?? 0;
              const rotulo = (
                <span className="flex w-[4.5rem] shrink-0">
                  <OrigemBadge sourceType={o} />
                </span>
              );
              return (
                <li key={o} className="flex items-center gap-3" title={SOURCE_TYPE_DESCRICOES[o]}>
                  {comLinks && n > 0 ? (
                    <Link
                      to={`/findings?applicationId=${encodeURIComponent(applicationId)}&sourceType=${o}&status=OPEN,IN_PROGRESS`}
                      aria-label={`Ver os ${n} findings abertos de origem ${o}`}
                      className="rounded-control focus-visible:outline-2"
                    >
                      {rotulo}
                    </Link>
                  ) : (
                    rotulo
                  )}
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-inset" aria-hidden="true">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / maior) * 100}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-fg" data-numeric>
                    {n}
                  </span>
                </li>
              );
            })}
          </ul>
          {total === 0 && <p className="text-sm text-fg-muted">Nenhum finding em aberto no recorte.</p>}
          {filaDeTriagem && (
            <p className="text-sm text-fg-muted">
              {fila === 0 ? (
                "Nenhum achado de código aguardando triagem."
              ) : (
                <>
                  Fila de triagem do código: <strong className="text-fg">{filaDeTriagem.SAST ?? 0} SAST</strong> e{" "}
                  <strong className="text-fg">{filaDeTriagem.SCA ?? 0} SCA</strong> ainda não triados na importação mais
                  recente.{" "}
                  {comLinks && (
                    <Link className="text-accent-ink hover:underline" to="/sast-sca">
                      Abrir SAST/SCA
                    </Link>
                  )}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
