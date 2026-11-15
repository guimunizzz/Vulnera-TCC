/**
 * inventario-tab.tsx
 *
 * O inventário de tecnologias da empresa (ADR-053, D19.3–D19.5):
 *  - SUGESTÕES que o Vulnera viu no uso (SBOM importado no SAST/SCA,
 *    fingerprint do DAST) — ninguém entra no inventário sem confirmação;
 *  - as tecnologias confirmadas, com quantas CVEs casaram com cada uma;
 *  - "Adicionar tecnologia": PACOTE (ecossistema + nome, casado pelo OSV) ou
 *    PRODUTO (fabricante + produto do dicionário CPE, casado pelo NVD).
 *
 * Quem não pode editar (PENTESTER, CLIENT MEMBER) vê a mesma lista sem botões.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { threatIntelApi } from "../../lib/api/threat-intel.api";
import { useApiError } from "../../hooks/use-api-error";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { EmptyState, ErrorState } from "../ui/empty-state";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { TABELA } from "../ui/table-estilos";
import { cn } from "../../lib/cn";
import { ECOSSISTEMAS, ROTULO_ORIGEM_ATIVO, type AtivoTI, type PermissoesThreatIntel, type ProdutoCpe } from "../../types/threat-intel.types";

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";
const MAX_SUGESTOES_VISIVEIS = 50;

export function InventarioTab({ companyId, permissoes }: { companyId: string; permissoes: PermissoesThreatIntel }) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const consulta = useQuery({ queryKey: ["threat-intel", "assets", companyId], queryFn: () => threatIntelApi.assets(companyId) });
  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ["threat-intel"] });
  const acao = useMutation({
    mutationFn: ({ tipo, id }: { tipo: "confirmar" | "descartar" | "remover"; id: string }) =>
      tipo === "confirmar" ? threatIntelApi.confirmAsset(id) : tipo === "descartar" ? threatIntelApi.dismissAsset(id) : threatIntelApi.removeAsset(id),
    onSuccess: atualizar,
    onError: (e) => setErro(getErrorMessage(e)),
  });
  const todas = useMutation({ mutationFn: () => threatIntelApi.confirmAll(companyId), onSuccess: atualizar, onError: (e) => setErro(getErrorMessage(e)) });

  const filtro = busca.trim().toLowerCase();
  const casa = (a: AtivoTI) => !filtro || a.displayName.toLowerCase().includes(filtro);
  const sugeridos = useMemo(() => (consulta.data ?? []).filter((a) => a.status === "SUGGESTED"), [consulta.data]);
  const confirmados = useMemo(() => (consulta.data ?? []).filter((a) => a.status === "CONFIRMED"), [consulta.data]);
  const sugeridosVisiveis = sugeridos.filter(casa);
  const confirmadosVisiveis = confirmados.filter(casa);

  if (consulta.isLoading) return <Skeleton className="h-24 w-full bg-inset" />;
  if (consulta.isError) return <ErrorState titulo="Não foi possível carregar o inventário" descricao={getErrorMessage(consulta.error)} aoTentarNovamente={() => consulta.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field rotulo="Buscar" className="min-w-[14rem] flex-1">
          {(attrs) => <Input {...attrs} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pacote, produto ou versão" />}
        </Field>
        {permissoes.editarInventario && (
          <Button onClick={() => setAdicionando(true)}>
            <Plus size={16} aria-hidden="true" /> Adicionar tecnologia
          </Button>
        )}
      </div>

      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {sugeridos.length > 0 && (
        <section aria-labelledby="ti-sugestoes" className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 id="ti-sugestoes" className="text-sm font-semibold text-fg">
                Sugestões ({sugeridos.length})
              </h3>
              <p className="text-xs text-fg-muted">
                O Vulnera viu estas tecnologias num SBOM importado ou no fingerprint de um scan DAST. Só entram na vigilância depois de confirmadas.
              </p>
            </div>
            {permissoes.editarInventario && (
              <Button variant="secundario" onClick={() => todas.mutate()} disabled={todas.isPending} carregando={todas.isPending}>
                <Check size={16} aria-hidden="true" /> Confirmar todas
              </Button>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-subtle">
            {sugeridosVisiveis.slice(0, MAX_SUGESTOES_VISIVEIS).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm text-fg">{a.displayName}</span>
                <Badge tom="acento">{ROTULO_ORIGEM_ATIVO[a.source]}</Badge>
                {permissoes.editarInventario && (
                  <>
                    <Button variant="secundario" size="sm" onClick={() => acao.mutate({ tipo: "confirmar", id: a.id })} aria-label={`Confirmar ${a.displayName}`}>
                      <Check size={14} aria-hidden="true" /> Confirmar
                    </Button>
                    <Button variant="fantasma" size="sm" onClick={() => acao.mutate({ tipo: "descartar", id: a.id })} aria-label={`Descartar ${a.displayName}`}>
                      <X size={14} aria-hidden="true" /> Descartar
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {sugeridosVisiveis.length > MAX_SUGESTOES_VISIVEIS && (
            <p className="text-xs text-fg-muted">
              Mostrando {MAX_SUGESTOES_VISIVEIS} de {sugeridosVisiveis.length}. Use a busca, ou "Confirmar todas".
            </p>
          )}
        </section>
      )}

      {confirmados.length === 0 ? (
        <EmptyState
          titulo="Nenhuma tecnologia no inventário"
          descricao="Adicione as bibliotecas e os produtos que a empresa usa, ou importe um SBOM no SAST/SCA: o Vulnera passa a avisar quando sair uma CVE que os afeta."
        />
      ) : (
        <div data-ops-surface className="overflow-x-auto rounded-container border border-subtle">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Tecnologias confirmadas no inventário</caption>
            <thead className={TABELA.cabecalho}>
              <tr>
                <th scope="col" className={TABELA.th}>Tecnologia</th>
                <th scope="col" className={TABELA.th}>Tipo</th>
                <th scope="col" className={cn(TABELA.th, "hidden sm:table-cell")}>Origem</th>
                <th scope="col" className={TABELA.th}>CVEs</th>
                <th scope="col" className={cn(TABELA.th, "hidden md:table-cell")}>Última consulta</th>
                {permissoes.editarInventario && (
                  <th scope="col" className={TABELA.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {confirmadosVisiveis.map((a) => (
                <tr key={a.id} className={TABELA.linha}>
                  <td className={TABELA.celula}>
                    <span className="flex flex-col gap-1">
                      <span className="text-fg">{a.displayName}</span>
                      {!a.version && <Badge tom="atencao">sem versão: casa com qualquer versão</Badge>}
                    </span>
                  </td>
                  <td className={TABELA.celula}>{a.kind === "PACKAGE" ? `Pacote ${a.ecosystem}` : "Produto (CPE)"}</td>
                  <td className={cn(TABELA.celula, "hidden sm:table-cell")}>{ROTULO_ORIGEM_ATIVO[a.source]}</td>
                  <td className={TABELA.celula} data-numeric>
                    {a.casamentos}
                  </td>
                  <td className={cn(TABELA.celula, "hidden text-fg-muted md:table-cell")}>
                    {a.lastSyncedAt ? new Date(a.lastSyncedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "na fila"}
                  </td>
                  {permissoes.editarInventario && (
                    <td className={TABELA.celula}>
                      <Button variant="fantasma" size="sm" rotulo={`Remover ${a.displayName}`} onClick={() => acao.mutate({ tipo: "remover", id: a.id })}>
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adicionando && <AdicionarDialog companyId={companyId} aoFechar={() => setAdicionando(false)} />}
    </div>
  );
}

function AdicionarDialog({ companyId, aoFechar }: { companyId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [kind, setKind] = useState<"PACKAGE" | "PRODUCT">("PACKAGE");
  const [ecosystem, setEcosystem] = useState<string>("npm");
  const [packageName, setPackageName] = useState("");
  const [cpeVendor, setCpeVendor] = useState("");
  const [cpeProduct, setCpeProduct] = useState("");
  const [cpePart, setCpePart] = useState("a");
  const [version, setVersion] = useState("");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoCpe[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useMutation({
    mutationFn: () => threatIntelApi.searchProducts(termo.trim(), companyId),
    onSuccess: (r) => {
      setErro(null);
      setResultados(r);
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });
  const salvar = useMutation({
    mutationFn: () =>
      threatIntelApi.addAsset(
        kind === "PACKAGE"
          ? { companyId, kind, ecosystem, packageName: packageName.trim(), version: version.trim() || null }
          : { companyId, kind, cpePart, cpeVendor: cpeVendor.trim(), cpeProduct: cpeProduct.trim(), version: version.trim() || null },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["threat-intel"] });
      aoFechar();
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });
  const podeSalvar = kind === "PACKAGE" ? !!packageName.trim() : !!cpeVendor.trim() && !!cpeProduct.trim();

  return (
    <Dialog aberto aoFechar={aoFechar} tamanho="lg">
      <DialogTitle>Adicionar tecnologia</DialogTitle>
      <DialogDescription>
        O Vulnera consulta as fontes por esta tecnologia agora (o que já existia aparece, sem notificar) e, depois, a cada sincronização.
      </DialogDescription>
      <DialogClose />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (podeSalvar) salvar.mutate();
        }}
      >
        {erro && <Alert tom="perigo">{erro}</Alert>}
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-sm font-medium text-fg">Tipo</legend>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="radio" name="tipo" checked={kind === "PACKAGE"} onChange={() => setKind("PACKAGE")} /> Pacote (npm, PyPI, Maven...) — via OSV
          </label>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="radio" name="tipo" checked={kind === "PRODUCT"} onChange={() => setKind("PRODUCT")} /> Produto (servidor, CMS, SO) — via NVD
          </label>
        </fieldset>

        {kind === "PACKAGE" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field rotulo="Ecossistema" obrigatorio>
              {(attrs) => (
                <select {...attrs} className={CLASSE_SELECT} value={ecosystem} onChange={(e) => setEcosystem(e.target.value)}>
                  {ECOSSISTEMAS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field rotulo="Nome do pacote" obrigatorio dica='Como no gerenciador: "lodash", "@angular/core", "org.apache.logging.log4j:log4j-core".'>
              {(attrs) => <Input {...attrs} value={packageName} onChange={(e) => setPackageName(e.target.value)} />}
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field rotulo="Buscar no dicionário CPE do NVD" className="min-w-[12rem] flex-1">
                {(attrs) => <Input {...attrs} value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="nginx, wordpress, tomcat..." />}
              </Field>
              <Button type="button" variant="secundario" disabled={termo.trim().length < 2 || buscar.isPending} carregando={buscar.isPending} onClick={() => buscar.mutate()}>
                <Search size={16} aria-hidden="true" /> Buscar
              </Button>
            </div>
            {resultados && (
              <ul aria-label="Produtos encontrados" className="flex max-h-[12rem] flex-col overflow-y-auto rounded-control border border-subtle">
                {resultados.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted">Nada encontrado. Digite fabricante e produto abaixo.</li>}
                {resultados.map((p) => (
                  <li key={`${p.cpePart}:${p.cpeVendor}:${p.cpeProduct}`}>
                    <button
                      type="button"
                      className={cn("flex w-full flex-col px-3 py-2 text-left hover:bg-inset", cpeVendor === p.cpeVendor && cpeProduct === p.cpeProduct && "bg-accent-surface")}
                      onClick={() => {
                        setCpePart(p.cpePart);
                        setCpeVendor(p.cpeVendor);
                        setCpeProduct(p.cpeProduct);
                      }}
                    >
                      <span className="text-sm text-fg">{p.titulo}</span>
                      <span className="font-mono text-xs text-fg-muted">
                        {p.cpeVendor}:{p.cpeProduct}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field rotulo="Fabricante (CPE)" obrigatorio>
                {(attrs) => <Input {...attrs} value={cpeVendor} onChange={(e) => setCpeVendor(e.target.value)} className="font-mono" />}
              </Field>
              <Field rotulo="Produto (CPE)" obrigatorio>
                {(attrs) => <Input {...attrs} value={cpeProduct} onChange={(e) => setCpeProduct(e.target.value)} className="font-mono" />}
              </Field>
            </div>
          </div>
        )}

        <Field rotulo="Versão em uso" dica="Sem versão, toda CVE do pacote/produto casa e o alerta diz que a versão não foi confirmada.">
          {(attrs) => <Input {...attrs} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="4.17.15" className="font-mono" />}
        </Field>

        <DialogFooter>
          <Button type="button" variant="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || salvar.isPending} carregando={salvar.isPending}>
            Adicionar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
