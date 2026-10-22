/**
 * filtros.ts
 *
 * Tudo que a exportação precisa saber DIZER sobre o recorte, em português: as
 * linhas "Filtros aplicados" da aba Resumo, a ordenação, o nome do arquivo e a
 * versão do filtro que vai para a auditoria. Funções puras — sem banco, sem
 * Express — para serem testadas direto.
 *
 * ⚠️ NOME DE FILTRO SÓ SAI SE O USUÁRIO PODE VER. Os nomes vêm de
 * `rotulos` (resolvidos pelo repository dentro do escopo de acesso). Um id
 * sem nome resolvido aparece CRU — o id que o próprio usuário enviou —, nunca
 * o nome de um recurso de outro tenant.
 */

import type { VulnerabilityQuery } from "../../models/vulnerability.model";
import type { LinhaDeFiltro } from "./planilha";
import { ROTULO_SEVERIDADE, ROTULO_STATUS, rotuloOwasp } from "./rotulos";
import { carimboDeArquivo, relogioSP } from "./tempo";

/** id → nome por dimensão; só o que o ator pode ver (ver `rotulosDoFiltro` no repository). */
export interface RotulosResolvidos {
  projetos: Map<string, string>;
  aplicacoes: Map<string, string>;
  empresas: Map<string, string>;
  responsaveis: Map<string, string>;
}

const ROTULO_SLA_FILTRO: Record<string, string> = {
  NO_SLA: "Sem SLA",
  ON_TRACK: "No prazo",
  DUE_SOON: "Vencendo",
  BREACHED: "Vencido",
  RESOLVED: "Resolvido",
};

const ROTULO_ACEITE: Record<string, string> = {
  ACTIVE: "Vigente",
  EXPIRED: "Expirado",
  REQUESTED: "Solicitado",
  NONE: "Sem aceite",
};

const ROTULO_ORDENACAO: Record<string, string> = {
  createdAt: "Data de detecção",
  severity: "Severidade",
  cvssScore: "CVSS",
  title: "Título",
  status: "Status",
  slaDueAt: "Prazo do SLA",
  vrsScore: "VRS",
};

const traduzir = (valores: string[], mapa: Record<string, string>): string => valores.map((v) => mapa[v] ?? v).join(", ");
const resolver = (ids: string[], nomes: Map<string, string>): string => ids.map((id) => nomes.get(id) ?? id).join(", ");

function dataHoraBR(d: Date): string {
  const r = relogioSP(d);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(r.getUTCDate())}/${dois(r.getUTCMonth() + 1)}/${r.getUTCFullYear()} ${dois(r.getUTCHours())}:${dois(r.getUTCMinutes())}`;
}

/** Algum filtro além da ordenação? Decide `filtrado` × `todos` no nome do arquivo. */
export function temFiltroAtivo(q: VulnerabilityQuery): boolean {
  return (
    q.projectIds.length > 0 ||
    q.applicationIds.length > 0 ||
    q.companyIds.length > 0 ||
    q.createdByIds.length > 0 ||
    q.severities.length > 0 ||
    q.statuses.length > 0 ||
    q.owaspCategories.length > 0 ||
    q.slaStates.length > 0 ||
    q.vrsMin !== undefined ||
    q.vrsMax !== undefined ||
    q.riskAcceptances.length > 0 ||
    q.assignedToIds.length > 0 ||
    q.semResponsavel === true ||
    Boolean(q.search) ||
    q.createdFrom !== undefined ||
    q.createdTo !== undefined
  );
}

export function descreverFiltros(q: VulnerabilityQuery, rotulos: RotulosResolvidos): LinhaDeFiltro[] {
  const linhas: LinhaDeFiltro[] = [];
  const add = (rotulo: string, valor: string): void => {
    if (valor) linhas.push({ rotulo, valor });
  };

  add("Projeto", resolver(q.projectIds, rotulos.projetos));
  add("Aplicação", resolver(q.applicationIds, rotulos.aplicacoes));
  add("Empresa", resolver(q.companyIds, rotulos.empresas));
  add("Criado por (id)", q.createdByIds.join(", "));
  add("Severidade", traduzir(q.severities, ROTULO_SEVERIDADE));
  add("Status", traduzir(q.statuses, ROTULO_STATUS));
  add("OWASP Top 10", q.owaspCategories.map(rotuloOwasp).join(", "));
  add("SLA", traduzir(q.slaStates, ROTULO_SLA_FILTRO));

  if (q.vrsMin !== undefined && q.vrsMax !== undefined) add("VRS", `de ${q.vrsMin} a ${q.vrsMax}`);
  else if (q.vrsMin !== undefined) add("VRS", `a partir de ${q.vrsMin}`);
  else if (q.vrsMax !== undefined) add("VRS", `até ${q.vrsMax}`);

  add("Aceite de risco", traduzir(q.riskAcceptances, ROTULO_ACEITE));

  const responsaveis = [resolver(q.assignedToIds, rotulos.responsaveis), q.semResponsavel ? "Sem responsável" : ""].filter(Boolean);
  add("Responsável", responsaveis.join(", "));

  add("Busca por texto", q.search ?? "");
  if (q.createdFrom) add("Detectado a partir de", dataHoraBR(q.createdFrom));
  if (q.createdTo) add("Detectado até", dataHoraBR(q.createdTo));
  return linhas;
}

export function descreverOrdenacao(q: Pick<VulnerabilityQuery, "sortBy" | "sortOrder">): string {
  return `${ROTULO_ORDENACAO[q.sortBy] ?? q.sortBy} (${q.sortOrder === "asc" ? "crescente" : "decrescente"})`;
}

/** Nome de projeto → fragmento seguro de nome de arquivo: minúsculo, sem acento, só `a-z0-9-`. */
export function slugDoNome(nome: string, maximo = 40): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximo)
    .replace(/-+$/g, "");
  return slug || "projeto";
}

/**
 * `findings_<escopo>_<AAAA-MM-DD_HHmm>.xlsx`.
 * Escopo: o slug do projeto quando o filtro pede UM projeto; senão `filtrado`
 * (há filtro) ou `todos` (nenhum). O `<escopo>` só carrega `a-z0-9-`: o nome
 * vai no header `Content-Disposition` e não pode trazer caractere de controle,
 * aspa, barra ou quebra de linha.
 */
export function nomeDoArquivo(opcoes: { projetoUnico: { name: string } | null; filtrado: boolean; geradoEm: Date }): string {
  const escopo = opcoes.projetoUnico ? slugDoNome(opcoes.projetoUnico.name) : opcoes.filtrado ? "filtrado" : "todos";
  return `findings_${escopo}_${carimboDeArquivo(opcoes.geradoEm)}.xlsx`;
}

/** O filtro como vai para o AuditLog: só o recorte pedido — sem paginação, sem escopo interno. */
export function filtroParaAuditoria(q: VulnerabilityQuery): Record<string, unknown> {
  return {
    projectIds: q.projectIds,
    applicationIds: q.applicationIds,
    companyIds: q.companyIds,
    createdByIds: q.createdByIds,
    severities: q.severities,
    statuses: q.statuses,
    owaspCategories: q.owaspCategories,
    slaStates: q.slaStates,
    vrsMin: q.vrsMin,
    vrsMax: q.vrsMax,
    riskAcceptances: q.riskAcceptances,
    assignedToIds: q.assignedToIds,
    semResponsavel: q.semResponsavel,
    search: q.search,
    createdFrom: q.createdFrom,
    createdTo: q.createdTo,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
  };
}
