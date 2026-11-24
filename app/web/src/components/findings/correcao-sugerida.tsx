/**
 * correcao-sugerida.tsx
 *
 * O QUE FAZ
 * A correção sugerida (ADR-063), sem IA (ADR-017): para dependência vulnerável
 * (SCA, Threat Intel), o comando de atualização e o trecho do manifesto no
 * formato do ecossistema, a partir da versão corrigida que a própria
 * ferramenta informou; para achado de código (SAST), o local, o trecho e a
 * recomendação da regra. Em todos, o link do advisory ou da regra.
 *
 * O QUE NÃO FAZ
 * Não inventa versão: sem versão corrigida publicada, diz isso. Não roda nada:
 * o comando é para a pessoa copiar e revisar.
 *
 * QUEM USA
 * Detalhe da vulnerabilidade, detalhe do achado na importação SAST/SCA e o
 * casamento do Threat Intel.
 */

import { useState } from "react";
import { Check, Copy, ExternalLink, Wrench } from "lucide-react";
import { Button } from "../ui/button";
import { lerPurl, linkDoAdvisory, linkSeguro, montarCorrecao, normalizarEcossistema } from "../../lib/correcao-sugerida";

export interface OrigemDaCorrecao {
  tipo: "SCA" | "SAST" | "THREAT_INTEL";
  ecossistema?: string | null;
  pacote?: string | null;
  versao?: string | null;
  purl?: string | null;
  versaoCorrigida?: string | null;
  advisoryId?: string | null;
  arquivo?: string | null;
  linha?: number | null;
  trecho?: string | null;
  recomendacao?: string | null;
  referencia?: string | null;
}

function BlocoCopiavel({ rotulo, conteudo }: { rotulo: string; conteudo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Sem permissão de área de transferência: o texto continua selecionável.
    }
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{rotulo}</p>
        <Button variant="fantasma" size="sm" rotulo={copiado ? "Copiado" : `Copiar ${rotulo.toLowerCase()}`} onClick={() => void copiar()}>
          {copiado ? <Check className="h-4 w-4 text-success-ink" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre rounded-control border border-subtle bg-inset p-3 font-mono text-xs text-fg">{conteudo}</pre>
      <span className="sr-only" role="status" aria-live="polite">
        {copiado ? "Copiado para a área de transferência." : ""}
      </span>
    </div>
  );
}

function LinkExterno({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-ink hover:underline">
      {children} <ExternalLink className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  );
}

export function CorrecaoSugerida({ origem }: { origem: OrigemDaCorrecao }) {
  const doPurl = lerPurl(origem.purl);
  const ecossistema = normalizarEcossistema(origem.ecossistema) ?? doPurl.ecossistema;
  // O nome do purl tem o grupo do Maven ("grupo/artefato"); o do relatório às vezes não.
  const pacote = (ecossistema === "maven" ? doPurl.nome : null) ?? origem.pacote ?? doPurl.nome;
  const dependencia = origem.tipo !== "SAST";
  const correcao = dependencia && ecossistema && pacote ? montarCorrecao({ ecossistema, pacote, versaoAtual: origem.versao ?? null, versoesCorrigidas: origem.versaoCorrigida ?? null }) : null;
  const advisory = linkDoAdvisory(origem.advisoryId);
  const referencia = linkSeguro(origem.referencia);

  return (
    <section aria-label="Correção sugerida" className="space-y-3 rounded-container border border-subtle bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Wrench className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Correção sugerida
      </p>

      {dependencia ? (
        correcao ? (
          <>
            <p className="text-sm text-fg-secondary">
              Atualize <span className="font-mono text-fg">{correcao.pacote}</span>
              {correcao.versaoAtual && (
                <>
                  {" "}de <span className="font-mono">{correcao.versaoAtual}</span>
                </>
              )}{" "}
              para <span className="font-mono font-semibold text-success-ink">{correcao.versaoSugerida}</span> ou posterior — a menor versão corrigida
              {correcao.versaoAtual ? " na mesma linha de release, quando existe" : ""}.
            </p>
            <BlocoCopiavel rotulo="Comando" conteudo={correcao.comando} />
            <BlocoCopiavel rotulo={`Em ${correcao.manifesto.arquivo}`} conteudo={correcao.manifesto.trecho} />
            <p className="text-xs text-fg-muted">Revise o changelog antes de subir: uma versão corrigida também pode trazer mudanças de comportamento.</p>
          </>
        ) : (
          <p className="text-sm text-fg-secondary">
            {origem.versaoCorrigida
              ? `Versão corrigida informada: ${origem.versaoCorrigida}. Não reconhecemos o ecossistema para montar o comando.`
              : "Ainda não há versão corrigida publicada. Acompanhe o advisory e avalie mitigar (desativar a funcionalidade afetada, regra no WAF) ou aceitar o risco."}
          </p>
        )
      ) : (
        <>
          {origem.arquivo && (
            <p className="font-mono text-xs text-fg-secondary">
              {origem.arquivo}
              {origem.linha ? `:${origem.linha}` : ""}
            </p>
          )}
          {origem.trecho && <BlocoCopiavel rotulo="Trecho" conteudo={origem.trecho} />}
          {origem.recomendacao ? (
            <p className="whitespace-pre-wrap text-sm text-fg-secondary">{origem.recomendacao}</p>
          ) : (
            <p className="text-sm text-fg-muted">A regra não trouxe recomendação; veja a referência.</p>
          )}
        </>
      )}

      {(advisory || referencia) && (
        <div className="flex flex-wrap gap-4 border-t border-subtle pt-3">
          {advisory && <LinkExterno href={advisory}>{origem.advisoryId?.toUpperCase().startsWith("CVE") ? "CVE no NVD" : "Advisory no GitHub"}</LinkExterno>}
          {referencia && <LinkExterno href={referencia}>Referência da regra</LinkExterno>}
        </div>
      )}
    </section>
  );
}
