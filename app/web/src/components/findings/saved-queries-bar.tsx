/**
 * saved-queries-bar.tsx
 *
 * O QUE FAZ
 * A faixa de buscas salvas acima da tabela de findings (CP-6): os atalhos que
 * a pessoa (e o time dela) guardou, e o botão de salvar a busca atual.
 *
 * 🎯 ABRIR UM ATALHO É NAVEGAR, NÃO CARREGAR UM SNAPSHOT.
 * Clicar num atalho troca a query string da própria página — `/findings?…` — e
 * a listagem busca de novo, com o escopo de quem clicou. É por isso que a
 * mesma watchlist mostra conjuntos diferentes para pessoas diferentes, que é
 * exatamente o comportamento correto num produto multi-tenant.
 *
 * O ESTADO "SALVO" É COMPARADO PELA FORMA CANÔNICA, não pelo texto da URL:
 * `?status=OPEN&severity=HIGH` e `?severity=HIGH&status=OPEN` são a mesma
 * busca, e o botão precisa dizer "já salva" nos dois casos. A canonização de
 * verdade acontece no servidor; aqui basta uma normalização equivalente para
 * decidir o rótulo do botão.
 *
 * QUEM USA
 * `pages/findings-page.tsx`.
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedQueriesApi } from "../../lib/api/saved-queries.api";
import { useApiError } from "../../hooks/use-api-error";
import { useAuthStore } from "../../store/auth.store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../ui/field";
import { Checkbox } from "../ui/checkbox";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { SAVED_QUERY_LIMITS, type SavedQuery } from "../../types/saved-query.types";

/** Parâmetros que não fazem parte da PERGUNTA — a API também os descarta. */
const IGNORADOS = new Set(["page", "pageSize"]);

/**
 * Normaliza uma query para comparação: mesma ordem, mesmos valores, sem
 * paginação. Equivalente à canonização do servidor para o que interessa aqui.
 */
function normalizar(params: URLSearchParams): string {
  const pares: Array<[string, string]> = [];
  for (const [chave, valor] of params) {
    if (IGNORADOS.has(chave) || !valor) continue;
    pares.push([chave, valor.split(",").sort().join(",")]);
  }
  pares.sort(([a], [b]) => a.localeCompare(b));
  return pares.map(([k, v]) => `${k}=${v}`).join("&");
}

export function SavedQueriesBar() {
  const [params, setParams] = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [abrindoFormulario, setAbrindoFormulario] = useState(false);
  const [nome, setNome] = useState("");
  const [compartilhar, setCompartilhar] = useState(false);
  const [fixar, setFixar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = useQuery({ queryKey: ["saved-queries"], queryFn: () => savedQueriesApi.list() });

  const atual = useMemo(() => normalizar(params), [params]);
  const jaSalva = useMemo(
    () => (lista.data ?? []).find((q) => normalizar(new URLSearchParams(q.queryString)) === atual),
    [lista.data, atual],
  );

  // PENTESTER atravessa empresas: "compartilhar com a empresa" não teria
  // destinatário definido, e o servidor recusa. A tela nem oferece.
  const podeCompartilhar = role !== "PENTESTER";

  const salvar = useMutation({
    mutationFn: () =>
      savedQueriesApi.create({
        name: nome.trim(),
        queryString: params.toString(),
        scope: compartilhar ? "COMPANY" : "PRIVATE",
        pinned: fixar,
      }),
    onSuccess: (criada) => {
      setAbrindoFormulario(false);
      setNome("");
      setErro(null);
      const perdidos = criada.descartados ?? [];
      setAviso(
        perdidos.length > 0
          ? `Busca salva. Estes filtros não foram guardados: ${perdidos.map((d) => d.param).join(", ")}.`
          : "Busca salva.",
      );
      void queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const remover = useMutation({
    mutationFn: (id: string) => savedQueriesApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["saved-queries"] }),
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const abrir = (q: SavedQuery): void => {
    // Navegação, não carregamento de resultado: a listagem busca de novo.
    setParams(new URLSearchParams(q.queryString));
  };

  const temFiltro = atual.length > 0;

  return (
    <section aria-label="Buscas salvas" className="mb-4 space-y-3">
      {/* ⚠️ A LISTA E AS AÇÕES SÃO CONTÊINERES SEPARADOS, de propósito.
          Quando estavam no mesmo flex, o botão "Salvar esta busca" era o
          próximo irmão dos atalhos — e, ao chegar a resposta da API, a lista
          ia de 0 para N itens, mudando a posição do botão entre os irmãos e
          fazendo o React REMONTÁ-LO. Quem clicasse naquele instante clicava
          num elemento que acabou de sair do DOM. Apareceu no E2E-EXP-05 como
          "element was detached from the DOM". */}
      <ul className="flex flex-wrap items-center gap-2">
        {(lista.data ?? []).map((q) => (
          <li key={q.id} className="flex items-center">
            <button
              type="button"
              onClick={() => abrir(q)}
              aria-current={jaSalva?.id === q.id ? "true" : undefined}
              className={[
                "flex min-h-touch items-center gap-2 rounded-l-control border px-3 py-1.5 text-sm",
                jaSalva?.id === q.id
                  ? "border-accent bg-accent-surface text-accent-ink"
                  : "border-subtle text-fg-secondary hover:text-fg",
              ].join(" ")}
              title={q.description ?? q.queryString}
            >
              {q.pinned && <span aria-hidden="true">📌</span>}
              <span>{q.name}</span>
              {q.scope === "COMPANY" && (
                <Badge tom="neutro" aria-label="Compartilhada com a empresa">
                  time
                </Badge>
              )}
            </button>

            {q.isOwner && (
              <button
                type="button"
                onClick={() => remover.mutate(q.id)}
                aria-label={`Remover a busca salva ${q.name}`}
                className="min-h-touch rounded-r-control border border-l-0 border-subtle px-2 py-1.5 text-sm text-fg-muted hover:text-danger-ink"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {temFiltro && !jaSalva && !abrindoFormulario && (
          <Button variant="sutil" size="sm" onClick={() => setAbrindoFormulario(true)}>
            Salvar esta busca
          </Button>
        )}
        {jaSalva && <span className="text-xs text-fg-muted">Esta busca já está salva como “{jaSalva.name}”.</span>}
      </div>

      {abrindoFormulario && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-container border border-subtle bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <Field rotulo="Nome da busca" className="min-w-[16rem] flex-1">
            {(props) => (
              <Input
                {...props}
                value={nome}
                maxLength={SAVED_QUERY_LIMITS.name}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: críticas estouradas"
              />
            )}
          </Field>

          {podeCompartilhar && (
            <Checkbox
              rotulo="Compartilhar com a empresa"
              checked={compartilhar}
              onChange={(e) => setCompartilhar(e.target.checked)}
            />
          )}
          <Checkbox rotulo="Fixar na barra lateral" checked={fixar} onChange={(e) => setFixar(e.target.checked)} />

          <div className="flex gap-2">
            <Button type="submit" size="sm" carregando={salvar.isPending} disabled={!nome.trim()}>
              Salvar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secundario"
              onClick={() => {
                setAbrindoFormulario(false);
                setErro(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {aviso && (
        <Alert tom="sucesso" aoFechar={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}
      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}
    </section>
  );
}
