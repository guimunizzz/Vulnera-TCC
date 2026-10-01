/**
 * dast-promotion.util.ts
 *
 * O QUE FAZ
 * Traduz um `DastFinding` (a linguagem do OWASP ZAP: pluginId, riskcode, CWE)
 * para os campos que uma `Vulnerability` exige (categoria OWASP Top 10, vetor
 * CVSS, título, descrição, recomendação). Tudo aqui é **sugestão**, nunca
 * decisão final.
 *
 * POR QUE EXISTE — e por que só sugere
 * O [[ADR-029 - DAST como silo]] recusou importar findings do ZAP direto pra
 * `Vulnerability` por uma razão específica: o ZAP **não fornece vetor CVSS**.
 * Ele dá `riskcode` (0..3) + `confidence` (1..4). Derivar um vetor completo
 * disso seria mapear 4 valores para um espaço de milhares — ou seja,
 * **inventar**. E um score inventado convincente é pior que score nenhum,
 * porque o resto do produto trata `cvssScore` como calculado com confiança
 * (RN10) e ninguém saberia, olhando a lista, quais são reais.
 *
 * A saída deste arquivo é a resposta que o próprio ADR-029 já apontava como
 * caminho legítimo: *"exigir triagem manual antes da promoção — um pentester
 * revisa o DastFinding e cria a Vulnerability com vetor real"*. O util
 * pré-preenche o formulário pra a promoção levar segundos em vez de minutos;
 * quem confirma o vetor é sempre o humano, na tela. Por isso o produto
 * continua sem nenhuma `Vulnerability` com CVSS estimado — a RN10 fica
 * intacta.
 *
 * QUEM CONSOME
 * `dast-scan.service.ts` (endpoint GET /findings/:id/promotion-draft, que
 * alimenta o formulário de promoção no front).
 */

import type { DastFinding, DastRisk } from "@prisma/client";

/**
 * Sugestão de vetor CVSS 3.1 por faixa de risco do ZAP.
 *
 * ⚠️ LEIA ANTES DE USAR EM QUALQUER OUTRO LUGAR: estes vetores são um PONTO
 * DE PARTIDA de formulário, não uma medição. Foram escolhidos como o caso
 * típico de uma vulnerabilidade web explorável pela rede, e a métrica de
 * impacto é a única que varia entre as faixas — porque é a única que o
 * `riskcode` do ZAP realmente informa. Todo o resto (AV/AC/PR/UI) é
 * suposição razoável que o pentester precisa confirmar contra o achado real.
 *
 * O caminho é sempre: sugestão -> revisão humana -> `calculateCvss` sobre o
 * vetor REVISADO. O score nunca sai daqui.
 */
const SUGGESTED_VECTOR_BY_RISK: Record<DastRisk, string> = {
  // Impacto alto nos três eixos, sem privilégio nem interação: o perfil de
  // um SQLi/RCE que o ZAP classifica como High.
  HIGH: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  // Impacto parcial — perfil de XSS refletido, exposição de dado sensível.
  MEDIUM: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
  // Só confidencialidade, e baixa: headers ausentes, banner de versão.
  LOW: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
  // Informativo não tem impacto por definição — o vetor resulta em score 0.0,
  // que é a leitura honesta: se vale promover, o pentester ajusta o vetor.
  INFO: "CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N",
};

/**
 * CWE -> categoria do OWASP Top 10 2021.
 *
 * Este mapeamento, ao contrário do vetor CVSS, é FACTUAL: o próprio OWASP
 * publica a lista de CWEs que compõem cada categoria do Top 10 2021. Cobre os
 * CWEs que o ZAP emite com mais frequência; o que não estiver aqui cai em
 * A06 (componentes vulneráveis) só como rótulo inicial de formulário — o
 * pentester troca no seletor se não for o caso.
 */
const OWASP_BY_CWE: Record<string, string> = {
  // A01 — Broken Access Control
  "22": "A01", // Path Traversal
  "200": "A01", // Exposição de informação
  "201": "A01",
  "352": "A01", // CSRF
  "548": "A01", // Listagem de diretório
  "601": "A01", // Redirecionamento aberto
  // A02 — Cryptographic Failures
  "319": "A02", // Transmissão em texto claro
  "326": "A02", // Criptografia fraca
  "327": "A02", // Algoritmo quebrado
  "614": "A02", // Cookie sem Secure
  "311": "A02",
  // A03 — Injection
  "20": "A03", // Validação de entrada
  "78": "A03", // OS Command Injection
  "79": "A03", // XSS
  "89": "A03", // SQL Injection
  "90": "A03", // LDAP Injection
  "91": "A03", // XML Injection
  "94": "A03", // Code Injection
  "116": "A03",
  "643": "A03", // XPath Injection
  // A04 — Insecure Design
  "209": "A04", // Mensagem de erro reveladora
  "525": "A04",
  // A05 — Security Misconfiguration
  "16": "A05", // Configuração
  "693": "A05", // Mecanismo de proteção ausente (CSP, headers)
  "1021": "A05", // Clickjacking / frame ausente
  "444": "A05", // Request smuggling
  "942": "A05", // CORS permissivo
  // A06 — Vulnerable and Outdated Components
  "1104": "A06",
  "829": "A06",
  // A07 — Identification and Authentication Failures
  "287": "A07",
  "384": "A07", // Session fixation
  "522": "A07",
  // A08 — Software and Data Integrity Failures
  "345": "A08",
  "353": "A08", // Subresource Integrity ausente
  "502": "A08", // Desserialização insegura
  // A09 — Security Logging and Monitoring Failures
  "778": "A09",
  // A10 — SSRF
  "918": "A10",
};

/** Categoria usada quando o CWE não está no mapa (ou o ZAP não mandou CWE). */
const OWASP_FALLBACK = "A06";

export function owaspCategoryForCwe(cweId: string | null): string {
  if (!cweId) return OWASP_FALLBACK;
  // O ZAP às vezes manda "79", às vezes "CWE-79" — normaliza pros dois.
  const normalized = cweId.replace(/^cwe-/i, "").trim();
  return OWASP_BY_CWE[normalized] ?? OWASP_FALLBACK;
}

export function suggestedVectorForRisk(risk: DastRisk): string {
  return SUGGESTED_VECTOR_BY_RISK[risk];
}

/** Rascunho pré-preenchido do formulário de promoção. Nada disto é salvo sem o pentester confirmar. */
export interface PromotionDraft {
  title: string;
  description: string;
  owaspCategory: string;
  /** Sugestão a revisar — ver o aviso no topo deste arquivo. */
  cvssVector: string;
  recommendation: string | null;
  impact: string | null;
}

/** Remove a marcação HTML que o ZAP usa nos campos de texto (`<p>`, `<br>`). */
function stripHtml(input: string | null): string | null {
  if (!input) return null;
  const text = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * Monta o rascunho a partir do finding. A descrição carrega a PROVENIÊNCIA em
 * texto (não só na coluna `sourceType`): quem abrir a Vulnerability meses
 * depois precisa ver, na própria descrição, que aquilo nasceu de um scan
 * automatizado, contra qual URL e em qual parâmetro.
 */
export function buildPromotionDraft(finding: DastFinding, targetUrl: string): PromotionDraft {
  const descricaoZap = stripHtml(finding.description);
  const partes = [
    descricaoZap ?? "Alerta reportado pelo OWASP ZAP sem descrição detalhada.",
    "",
    "--- Origem (scan DAST automatizado) ---",
    `Alvo do scan: ${targetUrl}`,
    `URL afetada: ${finding.url}`,
    finding.param ? `Parâmetro: ${finding.param}` : null,
    `Alerta do ZAP: ${finding.title} (plugin ${finding.pluginId}, confiança ${finding.confidence})`,
    finding.cweId ? `CWE-${finding.cweId.replace(/^cwe-/i, "")}` : null,
    finding.evidence ? `Evidência capturada: ${finding.evidence.slice(0, 500)}` : null,
  ].filter((linha): linha is string => linha !== null);

  return {
    title: finding.title,
    description: partes.join("\n"),
    owaspCategory: owaspCategoryForCwe(finding.cweId),
    cvssVector: suggestedVectorForRisk(finding.risk),
    recommendation: stripHtml(finding.solution),
    impact: null,
  };
}
