/**
 * paleta.ts
 *
 * O QUE FAZ
 * A busca da paleta de comandos (Ctrl+K, ADR-062), pura e testada: normaliza
 * (sem acento, minúsculas), pontua cada comando contra o que foi digitado e
 * devolve os melhores, sem misturar a ordem dos grupos.
 *
 * PONTUAÇÃO (maior = melhor; 0 = fora)
 *   rótulo começa com a consulta ........ 100
 *   uma palavra do rótulo começa com ela . 70
 *   o rótulo contém a consulta ........... 40
 *   todas as palavras da consulta aparecem (em qualquer ordem, no rótulo ou
 *   nas palavras-chave) .................. 20
 * Consulta vazia: todos passam, na ordem original.
 *
 * QUEM USA
 * `components/layout/paleta-de-comandos.tsx`. Testado em `paleta.test.ts`.
 */

export interface Comando {
  id: string;
  grupo: string;
  rotulo: string;
  /** Texto auxiliar à direita (ex.: "Aplicação · Produção"). */
  detalhe?: string;
  /** Termos extras que acham o comando (ex.: "tema", "dark"). */
  palavrasChave?: string[];
  executar: () => void;
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function pontuar(comando: Pick<Comando, "rotulo" | "palavrasChave">, consulta: string): number {
  const q = normalizar(consulta);
  if (!q) return 1;
  const rotulo = normalizar(comando.rotulo);
  if (rotulo.startsWith(q)) return 100;
  if (rotulo.split(/[\s·/—-]+/).some((p) => p.startsWith(q))) return 70;
  if (rotulo.includes(q)) return 40;
  const tudo = `${rotulo} ${(comando.palavrasChave ?? []).map(normalizar).join(" ")}`;
  return q.split(/\s+/).every((termo) => tudo.includes(termo)) ? 20 : 0;
}

/**
 * Os comandos que passam, até `limitePorGrupo` por grupo, cada grupo com os
 * seus mais bem pontuados primeiro e os grupos na ordem em que chegaram.
 */
export function filtrarComandos(comandos: Comando[], consulta: string, limitePorGrupo = 6): Comando[] {
  const porGrupo = new Map<string, Array<{ c: Comando; p: number; i: number }>>();
  comandos.forEach((c, i) => {
    const p = pontuar(c, consulta);
    if (p <= 0) return;
    porGrupo.set(c.grupo, [...(porGrupo.get(c.grupo) ?? []), { c, p, i }]);
  });
  return [...porGrupo.values()].flatMap((lista) =>
    lista
      .sort((a, b) => b.p - a.p || a.i - b.i)
      .slice(0, limitePorGrupo)
      .map((x) => x.c),
  );
}
