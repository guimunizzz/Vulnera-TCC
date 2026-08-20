/**
 * plans-page.tsx
 *
 * O QUE MUDOU NA FASE 6.5
 * - Skeleton com a FORMA dos três cards em vez de "Carregando planos…".
 * - `ErrorState` com botão de tentar novamente em vez de um parágrafo vermelho
 *   sem saída.
 * - `Button asChild` (que dependia do `Slot` do Radix) foi substituído por um
 *   `<Link>` com as classes do botão. Perde-se a composição automática; ganha-se
 *   não depender do Radix (ADR-023) e ficar explícito que o alvo é um link.
 * - Entrada escalonada dos cards (CP3), só na primeira montagem.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { plansApi } from "../lib/api/plans.api";
import { Card, ErrorState, Skeleton } from "../components/ui";
import { StaggerItem, StaggerList } from "../motion/components";

function formatarPreco(preco: number): string {
  // O plano Enterprise usa price=0 para representar "sob consulta" — formatar
  // como R$ 0,00 diria a coisa errada.
  if (preco <= 0) return "Sob consulta";
  return preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesmas proporções do card real — é o que evita o salto ao trocar. */
function EsqueletoDePlano() {
  return (
    <div className="flex flex-col gap-4 rounded-container border border-subtle bg-surface p-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-col gap-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export function PlansPage() {
  const { data: planos, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans"],
    queryFn: plansApi.list,
  });

  // Menor para maior por CAPACIDADE — o preço sozinho não serve de ranking
  // porque o Enterprise usa 0 para "sob consulta".
  const ordenados = [...(planos ?? [])].sort((a, b) => a.maxApplications - b.maxApplications);

  return (
    <div className="min-h-dvh bg-canvas px-4 py-16">
      <header className="mx-auto max-w-5xl text-center">
        <h1 className="text-3xl font-bold text-fg">Planos Vulnera</h1>
        <p className="mt-3 text-base text-fg-muted">
          Escolha o plano ideal para a maturidade de segurança da sua empresa.
        </p>
      </header>

      <div className="mx-auto mt-12 max-w-5xl">
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
            <span className="sr-only">Carregando planos</span>
            <EsqueletoDePlano />
            <EsqueletoDePlano />
            <EsqueletoDePlano />
          </div>
        )}

        {isError && (
          <ErrorState
            titulo="Não foi possível carregar os planos"
            descricao="A API não respondeu. Isso não impede o cadastro — você pode escolher o plano depois."
            aoTentarNovamente={() => refetch()}
          />
        )}

        {!isLoading && !isError && (
          <StaggerList className="grid gap-6 md:grid-cols-3">
            {ordenados.map((plano, i) => (
              <StaggerItem key={plano.id} indice={i}>
                <Card className="flex h-full flex-col">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-semibold uppercase text-accent-ink">{plano.name}</h2>
                    <p className="text-2xl font-bold text-fg" data-numeric>
                      {formatarPreco(plano.price)}
                      {plano.price > 0 && <span className="text-sm font-regular text-fg-muted">/mês</span>}
                    </p>
                  </div>

                  <ul className="mt-6 flex flex-1 flex-col gap-3 text-sm text-fg-secondary">
                    <li className="flex items-center gap-2">
                      <Marca /> Até <strong className="font-semibold text-fg">{plano.maxApplications}</strong> aplicações
                    </li>
                    <li className="flex items-center gap-2">
                      <Marca /> Até <strong className="font-semibold text-fg">{plano.maxProjects}</strong> projetos
                      simultâneos
                    </li>
                    <li className="flex items-center gap-2">
                      {plano.includesRemediation ? <Marca /> : <MarcaAusente />}
                      {plano.includesRemediation ? "Remediação incluída" : "Sem remediação incluída"}
                    </li>
                  </ul>

                  {/* Link com aparência de botão. Não é `<Button asChild>`: o
                      `asChild` dependia do `Slot` do Radix, removido no CP2. */}
                  <Link
                    to="/register"
                    className="press mt-6 inline-flex h-10 items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg shadow-raised transition-colors duration-fast hover:bg-accent-hover"
                  >
                    Começar com {plano.name}
                  </Link>
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </div>
    </div>
  );
}

function Marca() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-success" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarcaAusente() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-fg-muted" fill="none" aria-hidden="true">
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
