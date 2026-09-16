/**
 * query-suggestions.tsx
 *
 * O QUE FAZ
 * A caixa que abre abaixo da barra de busca mostrando o que dá para digitar:
 * os campos disponíveis quando o cursor está esperando um campo, e os valores
 * daquele campo quando está esperando um valor.
 *
 * POR QUE EXISTE
 * Uma linguagem de consulta que ninguém descobre é um campo de busca comum com
 * passos a mais. Quem abre a tela pela primeira vez não tem como saber que
 * existe `owasp`, que `severidade` aceita vários valores separados por vírgula,
 * ou que `!=` funciona. A caixa transforma a barra em algo explorável: abre no
 * clique, sem digitar nada, e responde à digitação.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE — padrão APG "combobox com listbox popup"
 * ==========================================================================
 *   - O `<input>` leva `role="combobox"`, `aria-expanded`, `aria-controls` e
 *     `aria-autocomplete="list"`.
 *   - O FOCO NUNCA SAI DO INPUT. A opção ativa é apontada por
 *     `aria-activedescendant` — mover o foco real para a opção impediria a
 *     pessoa de continuar digitando, que é o ponto todo de uma barra de busca.
 *     É a mesma decisão que o `Combobox` do design system tomou (`select.tsx`).
 *   - ↓ ↑ navegam · Home/End vão aos extremos · Enter escolhe · Esc fecha sem
 *     escolher · Tab fecha e segue.
 *   - A contagem de sugestões é anunciada por `aria-live="polite"`: filtrar de
 *     sete opções para uma é um evento silencioso sem isso.
 *   - Lista vazia vira TEXTO ("nenhuma sugestão"), não uma listbox sem filhos —
 *     uma listbox vazia não é anunciada e a pessoa fica sem resposta.
 * ==========================================================================
 *
 * QUEM USA
 * `findings-table.tsx`, exclusivamente.
 */

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "../../lib/cn";
import {
  CAMPOS,
  DESCRICAO_DOS_CAMPOS,
  SEVERIDADES,
  STATUS,
  analisarContexto,
  camposUsados,
  type ContextoDeSugestao,
  type FilterField,
} from "../../lib/finding-query";
import { ROTULO_SEVERIDADE, type Severidade } from "../ui/badge";
import { OWASP_CATEGORIES, OWASP_LABELS, type FacetCounts } from "../../types/vulnerability.types";

/** Uma entrada da caixa. `inserir` é o texto que vai para a barra. */
export interface Sugestao {
  /** O que é escrito na barra ao escolher. */
  inserir: string;
  /** O que a pessoa lê. Para entidade é o nome, não o id. */
  rotulo: string;
  /** Linha de apoio: descrição do campo, ou o exemplo. */
  apoio?: string;
  /** Contagem da faceta, quando existe. */
  contagem?: number;
}

/** Entidades que a barra sabe completar (nome na tela, id na expressão). */
export interface EntidadesSugeriveis {
  projeto?: { id: string; nome: string }[];
  aplicacao?: { id: string; nome: string }[];
  empresa?: { id: string; nome: string }[];
}

export interface QuerySuggestionsProps {
  /** Texto atual da barra. */
  valor: string;
  /** Posição do cursor — decide se estamos completando campo ou valor. */
  cursor: number;
  aberta: boolean;
  /** Campos que o contexto escondeu (ex.: `projeto` dentro de um projeto). */
  camposOcultos: FilterField[];
  facetas?: { severity: FacetCounts; status: FacetCounts; owasp: FacetCounts };
  entidades?: EntidadesSugeriveis;
  /** Chamado quando a pessoa escolhe. */
  aoEscolher: (sugestao: Sugestao, contexto: ContextoDeSugestao) => void;
  aoFechar: () => void;
  /** O input que a caixa controla — para o ARIA e para devolver o foco. */
  refDoCampo: RefObject<HTMLInputElement>;
}

/** Tira acento e baixa a caixa, para o filtro da lista casar como o parser casa. */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Monta a lista para o contexto atual.
 *
 * ⚠️ Um campo só é oferecido quando conseguimos COMPLETAR os valores dele.
 * `empresa` não aparece para quem não é ADMIN (o backend descarta o filtro de
 * qualquer forma) e `aplicacao` não aparece para o PENTESTER (o endpoint de
 * aplicações responde 403 para ele, então não haveria como resolver o nome
 * para id e o chip nasceria inválido). Oferecer um campo que não leva a lugar
 * nenhum é pior que não oferecer.
 */
function montarSugestoes(
  contexto: ContextoDeSugestao,
  valorAtual: string,
  camposOcultos: FilterField[],
  facetas: QuerySuggestionsProps["facetas"],
  entidades: EntidadesSugeriveis,
): Sugestao[] {
  const prefixo = normalizar(contexto.prefixo);
  const casa = (texto: string) => prefixo === "" || normalizar(texto).includes(prefixo);

  if (contexto.tipo === "campo") {
    const jaUsados = camposUsados(valorAtual);
    return (Object.keys(CAMPOS) as FilterField[])
      .filter((f) => !camposOcultos.includes(f))
      .filter((f) => (f === "empresa" ? Boolean(entidades.empresa) : true))
      .filter((f) => (f === "aplicacao" ? Boolean(entidades.aplicacao) : true))
      // campo já usado vai para o fim em vez de sumir: dá para trocar o valor
      .sort((a, b) => Number(jaUsados.includes(a)) - Number(jaUsados.includes(b)))
      .filter((f) => casa(f) || casa(DESCRICAO_DOS_CAMPOS[f].descricao))
      .map((field) => ({
        inserir: field,
        rotulo: field,
        apoio: `${DESCRICAO_DOS_CAMPOS[field].descricao} · ${DESCRICAO_DOS_CAMPOS[field].exemplo}`,
      }));
  }

  const { field } = contexto;

  if (field === "severidade") {
    return SEVERIDADES.filter((s) => casa(s) || casa(ROTULO_SEVERIDADE[s as Severidade] ?? "")).map((s) => ({
      inserir: s,
      rotulo: ROTULO_SEVERIDADE[s as Severidade] ?? s,
      apoio: s,
      contagem: facetas?.severity?.[s],
    }));
  }

  if (field === "status") {
    const rotulos: Record<string, string> = {
      OPEN: "Aberto",
      IN_PROGRESS: "Em andamento",
      FIXED: "Corrigido",
      CLOSED: "Fechado",
    };
    return STATUS.filter((s) => casa(s) || casa(rotulos[s] ?? "")).map((s) => ({
      inserir: s,
      rotulo: rotulos[s] ?? s,
      apoio: s,
      contagem: facetas?.status?.[s],
    }));
  }

  if (field === "owasp") {
    return OWASP_CATEGORIES.filter((o) => casa(o) || casa(OWASP_LABELS[o])).map((o) => ({
      inserir: o,
      rotulo: OWASP_LABELS[o],
      apoio: o,
      contagem: facetas?.owasp?.[o],
    }));
  }

  if (field === "titulo") return [];

  // SLA (CP-2): enum como severidade/status, com o vocabulário da BUSCA
  // (RESOLVED junta "no prazo" e "com atraso" — ver SLA_FILTER_VALUES).
  // Sem contagem: a faceta de SLA ficou fora da v1 (custaria 3 counts a mais
  // por busca). Autocontido de propósito — sem import novo neste arquivo.
  if (field === "sla") {
    const opcoes: Array<[string, string]> = [
      ["BREACHED", "Vencido"],
      ["DUE_SOON", "Vence em breve"],
      ["ON_TRACK", "No prazo"],
      ["RESOLVED", "Resolvido"],
      ["NO_SLA", "Sem SLA"],
    ];
    return opcoes
      .filter(([valor, rotulo]) => casa(valor) || casa(rotulo))
      .map(([valor, rotulo]) => ({ inserir: valor, rotulo, apoio: valor }));
  }

  // Entidade: mostra o NOME, insere o ID — a API aceita só id, de propósito
  // (nome não é único entre empresas).
  const lista = entidades[field] ?? [];
  return lista
    .filter((e) => casa(e.nome))
    .slice(0, 30)
    .map((e) => ({ inserir: e.id, rotulo: e.nome, apoio: "escolha para filtrar por este item" }));
}

export function QuerySuggestions({
  valor,
  cursor,
  aberta,
  camposOcultos,
  facetas,
  entidades = {},
  aoEscolher,
  aoFechar,
  refDoCampo,
}: QuerySuggestionsProps) {
  const idPainel = useId();
  const idDoItem = (i: number) => `${idPainel}-op-${i}`;
  const [ativo, setAtivo] = useState(0);
  const painelRef = useRef<HTMLDivElement>(null);

  const contexto = useMemo(() => analisarContexto(valor, cursor), [valor, cursor]);
  const sugestoes = useMemo(
    () => montarSugestoes(contexto, valor, camposOcultos, facetas, entidades),
    [contexto, valor, camposOcultos, facetas, entidades],
  );

  // A lista mudou de conteúdo: o índice ativo antigo pode apontar para uma
  // opção que não existe mais, ou pior, para outra opção.
  const campoDoContexto = contexto.tipo === "valor" ? contexto.field : null;
  useEffect(() => setAtivo(0), [contexto.tipo, campoDoContexto, contexto.prefixo]);

  /* --- teclado -----------------------------------------------------------
     Ligado ao INPUT, não ao painel: o foco nunca sai dele (ver o contrato no
     cabeçalho), então é ali que as teclas chegam. */
  useEffect(() => {
    const campo = refDoCampo.current;
    if (!campo || !aberta) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key === "Tab") {
        aoFechar();
        return;
      }
      if (sugestoes.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAtivo((i) => (i + 1) % sugestoes.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        setAtivo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setAtivo(sugestoes.length - 1);
      } else if (e.key === "Enter") {
        // ⚠️ Enter com a caixa aberta ESCOLHE; só aplica o filtro quando não
        // há sugestão selecionada. Sem isto, escolher uma opção e aplicar a
        // busca seriam a mesma tecla, e a pessoa perderia o que estava
        // montando no meio da expressão.
        e.preventDefault();
        e.stopPropagation();
        const escolhida = sugestoes[ativo];
        if (escolhida) aoEscolher(escolhida, contexto);
      }
    };

    campo.addEventListener("keydown", aoTeclar);
    return () => campo.removeEventListener("keydown", aoTeclar);
  }, [aberta, sugestoes, ativo, contexto, aoEscolher, aoFechar, refDoCampo]);

  /* --- ARIA no input ------------------------------------------------------ */
  useEffect(() => {
    const campo = refDoCampo.current;
    if (!campo) return;
    campo.setAttribute("role", "combobox");
    campo.setAttribute("aria-autocomplete", "list");
    campo.setAttribute("aria-expanded", String(aberta && sugestoes.length > 0));
    campo.setAttribute("aria-controls", idPainel);
    if (aberta && sugestoes.length > 0) campo.setAttribute("aria-activedescendant", idDoItem(ativo));
    else campo.removeAttribute("aria-activedescendant");
  });

  // Mantém a opção ativa visível quando se navega com as setas por uma lista
  // mais alta que a caixa.
  useEffect(() => {
    painelRef.current?.querySelector<HTMLElement>(`#${CSS.escape(idDoItem(ativo))}`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  if (!aberta) return null;

  const titulo =
    contexto.tipo === "campo"
      ? "Filtros disponíveis"
      : `Valores de ${CAMPOS[contexto.field].rotulo}`;

  return (
    <div
      ref={painelRef}
      className={cn(
        "absolute left-0 right-0 top-full z-dropdown mt-1 max-h-[20rem] overflow-y-auto",
        "rounded-container border border-subtle bg-overlay p-2 shadow-overlay",
      )}
    >
      <p className="px-2 pb-2 text-xs font-medium uppercase text-fg-muted">{titulo}</p>

      <span className="sr-only" role="status" aria-live="polite">
        {sugestoes.length === 0 ? "Nenhuma sugestão" : `${sugestoes.length} sugestões`}
      </span>

      {sugestoes.length === 0 ? (
        <p className="px-2 py-3 text-sm text-fg-muted">
          {contexto.tipo === "valor" && contexto.field === "titulo"
            ? "Digite o texto a procurar no título e na descrição."
            : "Nenhuma sugestão para o que foi digitado."}
        </p>
      ) : (
        <ul role="listbox" id={idPainel} aria-label={titulo} className="flex flex-col">
          {sugestoes.map((s, i) => (
            <li
              key={`${s.inserir}-${i}`}
              id={idDoItem(i)}
              role="option"
              aria-selected={i === ativo}
              // `onMouseDown` e não `onClick`: o clique tiraria o foco do
              // input antes de disparar, fechando a caixa por blur e engolindo
              // a escolha. `preventDefault` mantém o foco onde está.
              onMouseDown={(e) => {
                e.preventDefault();
                aoEscolher(s, contexto);
              }}
              onMouseEnter={() => setAtivo(i)}
              className={cn(
                "flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-sm",
                "transition-colors duration-fast",
                i === ativo ? "bg-accent-surface text-accent-ink" : "text-fg hover:bg-hovered",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.rotulo}</span>
                {s.apoio && <span className="block truncate text-xs text-fg-muted">{s.apoio}</span>}
              </span>
              {s.contagem !== undefined && (
                <span className="shrink-0 font-mono text-xs text-fg-muted" data-numeric>
                  {s.contagem}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-subtle px-2 pt-2 text-xs text-fg-muted">
        ↑ ↓ navegam · Enter escolhe · Esc fecha
      </p>
    </div>
  );
}
