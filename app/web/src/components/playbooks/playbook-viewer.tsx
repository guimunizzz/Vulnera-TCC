/**
 * playbook-viewer.tsx
 *
 * O QUE FAZ
 * Renderiza o conteúdo de um playbook de remediação (CP-5): as seções em
 * Markdown, os CWEs, as referências e a atribuição da fonte.
 *
 * ⚠️ AQUI EXISTE `dangerouslySetInnerHTML`, E ISSO É DELIBERADO.
 * O nome da prop é um aviso legítimo, e ele continua valendo: o HTML só é
 * seguro porque passou por `renderPlaybookMarkdown` (marked sem HTML bruto +
 * DOMPurify com allow-list), não porque veio da nossa API. Se alguém trocar
 * essa chamada por uma string qualquer, esta tela vira o XSS armazenado do
 * produto. A alternativa — montar nós React a partir do AST do Markdown —
 * seria reimplementar um renderizador inteiro para evitar uma prop com nome
 * feio, e trocaria um risco conhecido e testado por um código novo sem testes.
 *
 * Ver `lib/markdown.test.ts` (MD-01..MD-10) para o que essa camada barra.
 *
 * ATRIBUIÇÃO NÃO É OPCIONAL: o conteúdo oficial é CC BY-SA 4.0, e a licença
 * exige crédito visível. O rodapé de procedência só aparece quando a origem é
 * de fato OWASP — creditar um playbook escrito pela própria casa seria
 * atribuição falsa.
 *
 * QUEM USA
 * `/playbooks/:id` e o bloco "Como corrigir" do detalhe do finding.
 */

import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { renderPlaybookMarkdown } from "../../lib/markdown";
import { SECOES_PLAYBOOK, type Playbook } from "../../types/playbook.types";

/** Um bloco de Markdown já sanitizado. */
function SecaoMarkdown({ titulo, markdown }: { titulo: string; markdown: string }) {
  // `useMemo` porque sanitizar é trabalho de DOM real: reexecutar a cada
  // render de um conteúdo de 20 KB aparece na interação.
  const html = useMemo(() => renderPlaybookMarkdown(markdown), [markdown]);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{titulo}</h3>
      <div
        className="prose-playbook text-sm leading-relaxed text-fg"
        // Seguro por causa de renderPlaybookMarkdown — ver o cabeçalho.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export function PlaybookViewer({ playbook }: { playbook: Playbook }) {
  const secoes = SECOES_PLAYBOOK.filter((s) => {
    const valor = playbook[s.campo];
    return typeof valor === "string" && valor.trim().length > 0;
  });

  const { attribution, license, licenseUrl, sourceUrl, sourceVersion } = playbook.provenance;

  return (
    <article className="space-y-6">
      {playbook.summary && <SecaoMarkdown titulo="Resumo" markdown={playbook.summary} />}

      {secoes.map((s) => (
        <SecaoMarkdown key={s.campo} titulo={s.titulo} markdown={playbook[s.campo] as string} />
      ))}

      {playbook.cweIds.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">CWEs relacionadas</h3>
          <ul className="flex flex-wrap gap-2">
            {playbook.cweIds.map((cwe) => (
              <li key={cwe}>
                {/* O link vai para a página oficial da CWE no MITRE — https,
                    e em aba nova sem entregar window.opener. */}
                <a
                  href={`https://cwe.mitre.org/data/definitions/${cwe}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-severity-info-surface px-2 py-1 text-xs font-medium text-severity-info-ink underline-offset-2 hover:underline"
                >
                  CWE-{cwe}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {playbook.references.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Referências</h3>
          <ul className="space-y-1 text-sm">
            {playbook.references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink underline-offset-2 hover:underline"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attribution && (
        <footer className="rounded-container border border-subtle bg-inset p-3 text-xs text-fg-muted">
          <p>
            Conteúdo de{" "}
            {sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline-offset-2 hover:underline">
                {attribution}
              </a>
            ) : (
              attribution
            )}
            {license && (
              <>
                , sob licença{" "}
                {licenseUrl ? (
                  <a href={licenseUrl} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline-offset-2 hover:underline">
                    {license}
                  </a>
                ) : (
                  license
                )}
              </>
            )}
            .
          </p>
          {sourceVersion && <p className="mt-1">Importado em: {sourceVersion.replace("@", " · ")}</p>}
          {playbook.provenance.clonedFromId && (
            <p className="mt-1">Adaptado a partir de um playbook do catálogo — obra derivada.</p>
          )}
        </footer>
      )}
    </article>
  );
}

/** A tarja de origem, usada na listagem e no cabeçalho do detalhe. */
export function BadgeOrigem({ isSystem }: { isSystem: boolean }) {
  return isSystem ? (
    <Badge tom="acento" title="Conteúdo oficial da OWASP — somente leitura">
      OWASP
    </Badge>
  ) : (
    <Badge tom="neutro" title="Playbook escrito pela sua empresa">
      Da casa
    </Badge>
  );
}
