/**
 * font-safety.ts
 *
 * Detecta caracteres que NÃO vão renderizar nos relatórios PDF.
 *
 * Por que isso existe: os PDFs (lib/pdf/executive.ts e technical.ts) usam as
 * StandardFonts do pdf-lib (Helvetica), que só codificam **WinAnsi/cp1252**.
 * Emoji, setas unicode, aspas CJK, travessões fora do cp1252 — nada disso tem
 * glifo. A Fase 6 descobriu isso do jeito difícil: um finding com emoji
 * derrubava a geração do PDF inteiro. O conserto de lá (`sanitizeForFont`,
 * em lib/pdf/base.ts) troca o caractere por "?" na hora de desenhar — ou
 * seja, o relatório sai, mas com "?" no lugar do texto do usuário.
 *
 * O conserto está no lugar certo, mas o PROBLEMA nasce no editor de finding:
 * o pentester cola um texto do Slack/Jira com emoji, salva sem ver nada de
 * errado, e só descobre semanas depois quando o cliente abre o relatório.
 *
 * Este módulo é o aviso na origem — NÃO-BLOQUEANTE de propósito: o texto é
 * salvo do mesmo jeito (o dado no banco é UTF-8 e está correto), só avisamos
 * que aquele caractere específico vira "?" no PDF. Bloquear seria pior:
 * impediria o registro de um finding legítimo por causa de um emoji.
 *
 * Usado por: pages/finding-editor-page.tsx
 */

/**
 * Faixa de code points do WinAnsiEncoding (cp1252):
 *   - 0x20–0x7E  ASCII imprimível
 *   - 0xA0–0xFF  Latin-1 Supplement (acentuação do português inteira)
 *   - 0x80–0x9F  NÃO é Latin-1 aqui: o cp1252 usa essa faixa para um conjunto
 *                próprio de tipográficos, listado abaixo em code point real.
 */
const TIPOGRAFICOS_CP1252 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
  0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/** Controles que a geração de PDF já normaliza para espaço — não são problema. */
const CONTROLES_TOLERADOS = new Set([0x09, 0x0a, 0x0d]);

/** Um caractere renderiza no PDF? */
export function isRenderizavelNoPdf(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return true;
  if (CONTROLES_TOLERADOS.has(code)) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return TIPOGRAFICOS_CP1252.has(code);
}

/**
 * Devolve os caracteres distintos do texto que virariam "?" no PDF,
 * preservando a ordem de aparição. Vazio = tudo certo.
 */
export function acharCaracteresNaoRenderizaveis(...textos: Array<string | undefined | null>): string[] {
  const achados: string[] = [];
  const vistos = new Set<string>();

  for (const texto of textos) {
    if (!texto) continue;
    // itera por code point (não por UTF-16 unit), senão um emoji vira dois "?"
    for (const char of texto) {
      if (isRenderizavelNoPdf(char) || vistos.has(char)) continue;
      vistos.add(char);
      achados.push(char);
    }
  }

  return achados;
}
