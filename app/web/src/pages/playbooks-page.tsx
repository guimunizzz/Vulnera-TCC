/**
 * playbooks-page.tsx
 *
 * O QUE FAZ
 * O catálogo de remediação (CP-5): as dez categorias oficiais do OWASP Top 10
 * e os playbooks escritos pela própria empresa, no mesmo lugar, filtráveis por
 * categoria, origem e texto.
 *
 * QUEM VÊ O QUÊ
 *   Todos      → o catálogo System (global) e o custom da PRÓPRIA empresa.
 *                O recorte é feito no WHERE da API, não aqui.
 *   ADMIN/PENTESTER → podem criar, adaptar e remover playbooks da casa.
 *   CLIENT     → lê. Playbook é conhecimento técnico de remediação, e é a
 *                maior superfície de XSS armazenado do produto (D5).
 *
 * 🎯 POR QUE "ADAPTAR" E NÃO "EDITAR" NO CONTEÚDO OWASP
 * O System é imutável — inclusive para ADMIN. Editar o texto oficial e manter
 * o selo "OWASP" seria atribuir à OWASP algo que ela não escreveu. Quem precisa
 * mudar, duplica: o clone vira playbook da casa, preservando o crédito de obra
 * derivada que a licença CC BY-SA exige.
 *
 * QUEM USA
 * Rota `/playbooks`.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { playbooksApi } from "../lib/api/playbooks.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Card, Skeleton } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Field } from "../components/ui/field";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { BadgeOrigem } from "../components/playbooks/playbook-viewer";
import { markdownParaTexto } from "../lib/markdown";
import type { PlaybookListItem } from "../types/playbook.types";

/** Os nomes das categorias em pt-BR — os mesmos rótulos usados no finding. */
const CATEGORIAS: Array<{ valor: string; rotulo: string }> = [
  { valor: "A01", rotulo: "A01 · Quebra de Controle de Acesso" },
  { valor: "A02", rotulo: "A02 · Falhas Criptográficas" },
  { valor: "A03", rotulo: "A03 · Injeção" },
  { valor: "A04", rotulo: "A04 · Design Inseguro" },
  { valor: "A05", rotulo: "A05 · Configuração Incorreta" },
  { valor: "A06", rotulo: "A06 · Componentes Vulneráveis" },
  { valor: "A07", rotulo: "A07 · Falhas de Identificação e Autenticação" },
  { valor: "A08", rotulo: "A08 · Falhas de Integridade" },
  { valor: "A09", rotulo: "A09 · Falhas de Registro e Monitoramento" },
  { valor: "A10", rotulo: "A10 · SSRF" },
];

export function PlaybooksPage() {
  const role = useAuthStore((s) => s.user?.role);
  const podeEscrever = role === "ADMIN" || role === "PENTESTER";
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [origem, setOrigem] = useState<"" | "OWASP_TOP10" | "CUSTOM">("");
  const [aviso, setAviso] = useState<string | null>(null);

  const filtro = useMemo(
    () => ({
      search: busca.trim() || undefined,
      owaspCategory: categoria || undefined,
      source: origem || undefined,
    }),
    [busca, categoria, origem],
  );

  const lista = useQuery({
    queryKey: ["playbooks", filtro],
    queryFn: () => playbooksApi.list(filtro),
  });

  const clonar = useMutation({
    mutationFn: (id: string) => playbooksApi.clone(id),
    onSuccess: (novo) => {
      setAviso(`"${novo.title}" foi criado como playbook da sua empresa. Agora é editável.`);
      void queryClient.invalidateQueries({ queryKey: ["playbooks"] });
    },
    onError: (e) => setAviso(getErrorMessage(e)),
  });

  const agrupados = useMemo(() => {
    const mapa = new Map<string, PlaybookListItem[]>();
    for (const p of lista.data ?? []) {
      const chave = p.owaspCategory ?? "Sem categoria";
      const atual = mapa.get(chave) ?? [];
      atual.push(p);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [lista.data]);

  return (
    <div className="space-y-6">
      <Breadcrumb itens={[{ rotulo: "Início", para: "/dashboard" }, { rotulo: "Playbooks" }]} />

      <header data-ops-hero="playbook" className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Base de conhecimento</p>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Playbooks de remediação</h1>
        <p className="text-sm text-fg-secondary">
          O conteúdo oficial do OWASP Top 10 e os playbooks escritos pela sua empresa. O que vem da OWASP é somente
          leitura — para adaptar, duplique.
        </p>
      </header>

      {aviso && (
        <Alert tom="info" aoFechar={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <Card titulo="Filtros">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field rotulo="Buscar por título">
            {(props) => (
              <Input
                {...props}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: injeção"
                type="search"
              />
            )}
          </Field>

          <Field rotulo="Categoria OWASP">
            {(props) => (
              <Select
                {...props}
                valor={categoria}
                aoMudar={setCategoria}
                opcoes={[{ valor: "", rotulo: "Todas" }, ...CATEGORIAS]}
              />
            )}
          </Field>

          <Field rotulo="Origem">
            {(props) => (
              <Select
                {...props}
                valor={origem}
                aoMudar={(v) => setOrigem(v as typeof origem)}
                opcoes={[
                  { valor: "", rotulo: "Todas" },
                  { valor: "OWASP_TOP10", rotulo: "OWASP (oficial)" },
                  { valor: "CUSTOM", rotulo: "Da minha empresa" },
                ]}
              />
            )}
          </Field>
        </div>
      </Card>

      {lista.isLoading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {lista.isError && (
        <ErrorState descricao={getErrorMessage(lista.error)} aoTentarNovamente={() => void lista.refetch()} />
      )}

      {lista.isSuccess && lista.data.length === 0 && (
        <EmptyState
          titulo="Nenhum playbook encontrado"
          descricao={
            busca || categoria || origem
              ? "Nenhum playbook corresponde aos filtros. Tente ampliar a busca."
              : "O catálogo oficial ainda não foi importado. Rode `npm run db:seed:playbooks` na API."
          }
        />
      )}

      {lista.isSuccess &&
        agrupados.map(([chave, itens]) => (
          <section key={chave} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
              {CATEGORIAS.find((c) => c.valor === chave)?.rotulo ?? chave}
            </h2>

            <ul className="grid gap-3 md:grid-cols-2">
              {itens.map((p) => (
                <li key={p.id}>
                  <article data-ops-lift className="flex h-full flex-col gap-2 rounded-container border border-subtle bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/playbooks/${p.id}`}
                        className="text-sm font-semibold text-fg underline-offset-2 hover:underline"
                      >
                        {p.title}
                      </Link>
                      <BadgeOrigem isSystem={p.isSystem} />
                    </div>

                    {p.summary && (
                      <p className="flex-1 text-sm text-fg-secondary">{markdownParaTexto(p.summary, 180)}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-fg-muted">
                        {p.clonedFromId ? "Adaptado do catálogo" : p.isSystem ? "Conteúdo oficial" : "Escrito pela casa"}
                      </span>

                      {podeEscrever && p.isSystem && (
                        <Button
                          variant="secundario"
                          size="sm"
                          onClick={() => clonar.mutate(p.id)}
                          disabled={clonar.isPending}
                        >
                          Duplicar e adaptar
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
