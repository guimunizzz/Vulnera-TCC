/**
 * how-to-fix-panel.tsx
 *
 * O QUE FAZ
 * O bloco "Como corrigir" do detalhe de um finding (CP-5): resolve os
 * playbooks da categoria OWASP do achado e mostra o conteúdo do primeiro já
 * aberto, com os demais a um clique.
 *
 * 🎯 A ORDEM É A REGRA, E ELA É DELIBERADA (docs/DECISIONS.md D5)
 * O playbook da PRÓPRIA EMPRESA vem primeiro; o oficial da OWASP depois. Para
 * quem vai corrigir, "como se faz aqui" vale mais que a referência genérica —
 * é a instrução que conhece o stack, o processo de deploy e o que já foi
 * decidido antes. O conteúdo da OWASP continua logo abaixo, porque ele é a
 * fundamentação de que o revisor precisa.
 *
 * ABRE FECHADO QUANDO NÃO HÁ CATEGORIA: um finding sem `owaspCategory` não tem
 * como resolver playbook, e mostrar um bloco vazio sugeriria que falta
 * conteúdo, quando o que falta é a classificação do achado.
 *
 * QUEM USA
 * `pages/finding-detail-page.tsx`.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { playbooksApi } from "../../lib/api/playbooks.api";
import { useApiError } from "../../hooks/use-api-error";
import { Card, Skeleton } from "../ui/card";
import { Alert } from "../ui/alert";
import { BadgeOrigem, PlaybookViewer } from "../playbooks/playbook-viewer";

interface Props {
  /** A categoria OWASP do finding. Sem ela não há o que resolver. */
  owaspCategory: string | null | undefined;
  /** A empresa DO FINDING — é o custom dela que interessa, não o do leitor. */
  companyId: string;
}

export function HowToFixPanel({ owaspCategory, companyId }: Props) {
  const getErrorMessage = useApiError();
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ["playbooks", "for-category", owaspCategory, companyId],
    queryFn: () => playbooksApi.forCategory(owaspCategory as string, companyId),
    enabled: Boolean(owaspCategory && companyId),
  });

  // O primeiro da lista já vem aberto: o custom do tenant, quando existe.
  useEffect(() => {
    if (!selecionado && lista.data?.[0]) setSelecionado(lista.data[0].id);
  }, [lista.data, selecionado]);

  const detalhe = useQuery({
    queryKey: ["playbooks", selecionado],
    queryFn: () => playbooksApi.getById(selecionado as string),
    enabled: Boolean(selecionado),
  });

  if (!owaspCategory) return null;

  return (
    <Card titulo="Como corrigir" descricao={`Playbooks da categoria OWASP ${owaspCategory}.`}>
      {lista.isLoading && <Skeleton className="h-24 w-full" />}

      {lista.isError && <Alert tom="atencao">{getErrorMessage(lista.error)}</Alert>}

      {lista.isSuccess && lista.data.length === 0 && (
        <p className="text-sm text-fg-muted">
          Nenhum playbook cadastrado para {owaspCategory}. O catálogo oficial da OWASP é importado no setup da API
          (&ldquo;db:seed:playbooks&rdquo;).
        </p>
      )}

      {lista.isSuccess && lista.data.length > 0 && (
        <div className="space-y-4">
          {lista.data.length > 1 && (
            <ul className="flex flex-wrap gap-2" aria-label="Playbooks disponíveis">
              {lista.data.map((p) => {
                const ativo = p.id === selecionado;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionado(p.id)}
                      aria-pressed={ativo}
                      className={[
                        "flex min-h-touch items-center gap-2 rounded-control border px-3 py-1.5 text-sm",
                        ativo ? "border-accent bg-accent-surface text-accent-ink" : "border-subtle text-fg-secondary",
                      ].join(" ")}
                    >
                      <span>{p.title}</span>
                      <BadgeOrigem isSystem={p.isSystem} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {detalhe.isLoading && <Skeleton className="h-40 w-full" />}
          {detalhe.isError && <Alert tom="atencao">{getErrorMessage(detalhe.error)}</Alert>}
          {detalhe.data && (
            <>
              <PlaybookViewer playbook={detalhe.data} />
              <p className="text-xs text-fg-muted">
                <Link to={`/playbooks/${detalhe.data.id}`} className="text-accent-ink hover:underline">
                  Abrir no catálogo
                </Link>
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
